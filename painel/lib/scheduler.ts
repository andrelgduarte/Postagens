import { loadConfig, type Config } from "./config";
import {
  getPostBySlugGlobal,
  listPosts,
  writeMetaGlobal,
  type PostMeta,
} from "./posts";
import { publishInstagram } from "./instagram";
import { logEvent } from "./publish-log";
import { showToast } from "./notify";
import { collectInsightsTick } from "./insights";
import { getUserEmail } from "./auth";
import { resendEnabled, sendEmail } from "./email";
import { maintainTokens } from "./token-maintenance";
import { listUsersWithActivity } from "./users";
import { getMinutesInTZ, zonedISOToUtc } from "./tz";
import { publishLinkedInPost } from "./linkedin-publish";

export type TickOptions = {
  now?: Date;
  dryRun?: boolean;
  notify?: boolean;
};

export type TickResult = {
  considered: number;
  published: string[];
  skipped: { slug: string; reason: string }[];
  failed: { slug: string; reason: string }[];
  insights: { slug: string; milestone: string; ok: boolean }[];
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isInWindow(now: Date, config: Config): boolean {
  const minutes = getMinutesInTZ(now);
  const start = toMinutes(config.scheduler.window_start);
  const end = toMinutes(config.scheduler.window_end);
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

function parseScheduled(scheduled: string): Date | null {
  return zonedISOToUtc(scheduled);
}

function readyForRetry(meta: PostMeta, now: Date, retryDelayMin: number): boolean {
  if (!meta.last_attempt) return true;
  const last = new Date(meta.last_attempt).getTime();
  return now.getTime() - last >= retryDelayMin * 60_000;
}

export type DueCandidate = {
  slug: string;
  reason?: string;
};

export async function findDuePostsForUser(
  now: Date,
  config: Config,
  userId: string
): Promise<DueCandidate[]> {
  const posts = await listPosts(userId);
  const out: DueCandidate[] = [];
  for (const p of posts) {
    const m = p.meta;
    if (!m.auto_publish) continue;
    if (m.status_ig === "posted") continue;
    if (m.status_ig === "skipped") continue;
    if (m.status_ig === "failed") continue;
    if (!m.scheduled) {
      out.push({ slug: p.slug, reason: "sem scheduled" });
      continue;
    }
    const when = parseScheduled(m.scheduled);
    if (!when) {
      out.push({ slug: p.slug, reason: "scheduled inválido" });
      continue;
    }
    if (when.getTime() > now.getTime()) continue;
    if (!readyForRetry(m, now, config.scheduler.retry_delay_minutes)) {
      out.push({ slug: p.slug, reason: "aguardando retry_delay" });
      continue;
    }
    out.push({ slug: p.slug });
  }
  return out;
}

export async function findDueLIPostsForUser(
  now: Date,
  userId: string
): Promise<string[]> {
  const posts = await listPosts(userId);
  const out: string[] = [];
  for (const p of posts) {
    const m = p.meta;
    if (!m.auto_publish) continue;
    if (m.status_li !== "queued") continue;
    if (!m.scheduled) continue;
    const when = parseScheduled(m.scheduled);
    if (!when) continue;
    if (when.getTime() > now.getTime()) continue;
    out.push(p.slug);
  }
  return out;
}

async function publishOne(
  slug: string,
  config: Config,
  now: Date,
  opts: TickOptions
): Promise<{ ok: true; postId: string; accountName: string } | { ok: false; reason: string }> {
  const post = await getPostBySlugGlobal(slug);
  if (!post) return { ok: false, reason: "post não existe" };

  const meta = post.meta;
  const type =
    meta.type ?? (post.videos.length > 0 ? "reel" : post.images.length >= 2 ? "carousel" : "single");
  const needsVideo = type === "reel" || (type === "story" && post.videos.length > 0);

  if (needsVideo && post.videos.length === 0) return { ok: false, reason: "sem vídeo" };
  if (!needsVideo && post.images.length === 0) return { ok: false, reason: "sem imagens" };
  if (type !== "story" && !post.captionIg.trim()) {
    return { ok: false, reason: "caption_ig vazia" };
  }

  const attempt = (meta.attempts ?? 0) + 1;
  await logEvent({
    event: "publish_start",
    slug,
    attempt,
    account: meta.account_id,
  });

  if (opts.dryRun) {
    return { ok: true, postId: "dry-run", accountName: "dry-run" };
  }

  try {
    const { postId, accountName } = await publishInstagram({
      slug,
      type,
      images: post.images,
      videos: post.videos,
      caption: post.captionIg,
      accountId: meta.account_id,
      userId: post.userId,
    });
    const next: PostMeta = {
      ...meta,
      status_ig: "posted",
      ig_post_id: postId,
      attempts: attempt,
      last_attempt: now.toISOString(),
      last_error: undefined,
      published_at: now.toISOString(),
    };
    await writeMetaGlobal(slug, next);
    return { ok: true, postId, accountName };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const giveUp = attempt >= config.scheduler.retries;
    const next: PostMeta = {
      ...meta,
      status_ig: giveUp ? "failed" : "queued",
      attempts: attempt,
      last_attempt: now.toISOString(),
      last_error: reason,
    };
    await writeMetaGlobal(slug, next);
    if (giveUp) {
      await logEvent({ event: "give_up", slug, attempt, message: reason });
    } else {
      await logEvent({
        event: "retry_scheduled",
        slug,
        attempt,
        message: `nova tentativa em ${config.scheduler.retry_delay_minutes}min`,
      });
    }
    return { ok: false, reason };
  }
}

async function notifyByEmail(
  userId: string,
  opts: { subject: string; text: string }
): Promise<void> {
  if (!resendEnabled()) return;
  try {
    const to = await getUserEmail(userId);
    if (!to) return;
    await sendEmail({ to, subject: opts.subject, text: opts.text });
  } catch (e) {
    await logEvent({
      event: "publish_fail",
      message: `email notify: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

async function runLIPass(
  userId: string,
  _config: Config,
  now: Date,
  opts: TickOptions,
  result: TickResult
): Promise<void> {
  const slugs = await findDueLIPostsForUser(now, userId);
  for (const slug of slugs) {
    const post = await getPostBySlugGlobal(slug);
    if (!post) continue;
    if (!post.captionLi.trim()) {
      await logEvent({ event: "skip", slug, message: "LI: caption vazia" });
      continue;
    }
    await logEvent({ event: "publish_start", slug, message: "LI API" });

    if (opts.dryRun) {
      result.published.push(`${slug} (LI dry-run)`);
      continue;
    }

    const r = await publishLinkedInPost({ userId, post });
    if (r.ok) {
      await writeMetaGlobal(slug, { ...post.meta, status_li: "posted" });
      result.published.push(`${slug} (LI)`);
      await logEvent({ event: "publish_ok", slug, message: `LI API ${r.postUrn || "ok"}` });
      if (post.userId) {
        await notifyByEmail(post.userId, {
          subject: `✓ Postado no LinkedIn: ${post.title}`,
          text:
            `LinkedIn aceitou o post.\n\n` +
            `Slug: ${slug}\nTítulo: ${post.title}\nURN: ${r.postUrn}\n`,
        });
      }
    } else {
      result.failed.push({ slug, reason: r.error });
      await logEvent({ event: "publish_fail", slug, message: `LI API: ${r.error}` });
      if (post.userId) {
        await notifyByEmail(post.userId, {
          subject: `✗ Falha LinkedIn: ${post.title}`,
          text:
            `Publicação no LinkedIn falhou.\n\n` +
            `Slug: ${slug}\nTítulo: ${post.title}\nErro: ${r.error}\n`,
        });
      }
    }
  }
}

async function runUserPass(
  userId: string,
  now: Date,
  opts: TickOptions,
  result: TickResult
): Promise<void> {
  const config = await loadConfig(userId);

  if (!config.scheduler.enabled && !opts.dryRun) {
    await logEvent({
      event: "skip",
      message: `${userId}: scheduler desabilitado`,
    });
    return;
  }

  if (!isInWindow(now, config)) {
    await logEvent({
      event: "skip",
      message: `${userId}: fora da janela ${config.scheduler.window_start}-${config.scheduler.window_end}`,
    });
    return;
  }

  const candidates = await findDuePostsForUser(now, config, userId);
  result.considered += candidates.length;

  for (const c of candidates) {
    if (c.reason) {
      result.skipped.push({ slug: c.slug, reason: c.reason });
      await logEvent({ event: "skip", slug: c.slug, message: c.reason });
      continue;
    }
    await logEvent({ event: "due", slug: c.slug });
    const post = await getPostBySlugGlobal(c.slug);
    const r = await publishOne(c.slug, config, now, opts);
    if (r.ok) {
      result.published.push(c.slug);
      await logEvent({
        event: "publish_ok",
        slug: c.slug,
        post_id: r.postId,
        account: r.accountName,
      });
      if (opts.notify) {
        showToast(`✓ Postado no IG`, `${c.slug} (${r.accountName})`).catch(() => {});
      }
      if (!opts.dryRun && post) {
        await notifyByEmail(post.userId, {
          subject: `✓ Postado no IG: ${post.title}`,
          text:
            `Post publicado com sucesso.\n\n` +
            `Slug: ${c.slug}\nTítulo: ${post.title}\nConta: ${r.accountName}\nIG post id: ${r.postId}\n`,
        });
      }
    } else {
      result.failed.push({ slug: c.slug, reason: r.reason });
      await logEvent({
        event: "publish_fail",
        slug: c.slug,
        message: r.reason,
      });
      if (opts.notify) {
        showToast(`✗ Falha no IG`, `${c.slug}: ${r.reason}`.slice(0, 200)).catch(() => {});
      }
      if (!opts.dryRun && post) {
        await notifyByEmail(post.userId, {
          subject: `✗ Falha ao publicar no IG: ${post.title}`,
          text:
            `Tentativa de publicação falhou.\n\n` +
            `Slug: ${c.slug}\nTítulo: ${post.title}\nErro: ${r.reason}\n`,
        });
      }
    }
  }

  // LinkedIn webhook pass (independente do IG)
  await runLIPass(userId, config, now, opts, result);
}

export async function runTick(opts: TickOptions = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  const result: TickResult = {
    considered: 0,
    published: [],
    skipped: [],
    failed: [],
    insights: [],
  };

  await logEvent({
    event: "tick_start",
    message: opts.dryRun ? "dry-run" : "live",
  });

  // Manutenção de tokens é global (cobre todas as contas com credenciais)
  if (!opts.dryRun) {
    try {
      await maintainTokens(now);
    } catch (e) {
      await logEvent({
        event: "publish_fail",
        message: `token maintenance: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Itera por usuário — cada um respeita sua própria config
  const userIds = await listUsersWithActivity();
  for (const userId of userIds) {
    try {
      await runUserPass(userId, now, opts, result);
    } catch (e) {
      await logEvent({
        event: "publish_fail",
        message: `${userId}: tick pass failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Insights também são globais
  if (!opts.dryRun) {
    try {
      const collected = await collectInsightsTick(now);
      result.insights = collected
        .filter((c) => c.milestone)
        .map((c) => ({ slug: c.slug, milestone: c.milestone!, ok: c.ok }));
    } catch (e) {
      await logEvent({
        event: "publish_fail",
        message: `insights tick: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  await logEvent({ event: "tick_end" });
  return result;
}
