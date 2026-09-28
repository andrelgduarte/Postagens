import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { linkedinAccounts } from "./db/schema";
import { logEvent } from "./publish-log";
import { resendEnabled, sendEmail } from "./email";

// Avisa quando faltar isso ou menos pra expirar (o refresh automático do
// publish só cobre <7 dias E só quando há posts sendo publicados).
const WARN_WITHIN_MS = 7 * 86_400_000;
// Não reenvia se já mandou lembrete nas últimas ~20h (o tick roda 2x/dia).
const DEDUPE_WINDOW = "20 hours";
const REMINDER_EVENT = "li_token_reminder";

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://app.andrelgduarte.com.br").replace(/\/$/, "");
}

export type TokenCheckResult = {
  checked: number;
  warned: Array<{ name: string; daysLeft: number; sent: boolean; reason?: string }>;
};

/**
 * Verifica os tokens do LinkedIn e envia lembrete por e-mail quando um token
 * está a <=7 dias de expirar (ou já expirou) e a conta NÃO tem refresh_token
 * (i.e. não renova sozinha — ver lib/linkedin-token-renewal na memória).
 * Idempotente por dia via event_log (evento `li_token_reminder`).
 */
export async function checkLinkedinTokens(opts: { dryRun?: boolean } = {}): Promise<TokenCheckResult> {
  const accounts = await db.select().from(linkedinAccounts);
  const now = Date.now();
  const warned: TokenCheckResult["warned"] = [];

  for (const acc of accounts) {
    // Contas com refresh_token renovam automaticamente no publish — não avisa.
    if (acc.refreshToken) continue;
    if (!acc.tokenExpiresAt) continue;

    const msLeft = acc.tokenExpiresAt.getTime() - now;
    if (msLeft > WARN_WITHIN_MS) continue;

    const daysLeft = Math.floor(msLeft / 86_400_000);

    // dedupe: já avisou nas últimas ~20h?
    const recent = await db.execute(sql`
      SELECT 1 FROM event_log
      WHERE event = ${REMINDER_EVENT}
        AND account = ${acc.personUrn}
        AND ts >= now() - INTERVAL '${sql.raw(DEDUPE_WINDOW)}'
      LIMIT 1
    `);
    if (recent.rows.length > 0) {
      warned.push({ name: acc.name, daysLeft, sent: false, reason: "já avisado nas últimas 20h" });
      continue;
    }

    const expired = msLeft <= 0;
    const subject = expired
      ? `⚠️ LinkedIn desconectado — token expirou (${acc.name})`
      : `⚠️ LinkedIn: reconecte em ${daysLeft} dia(s) — ${acc.name}`;
    const when = expired
      ? "O token do LinkedIn JÁ EXPIROU."
      : `O token do LinkedIn expira em ${daysLeft} dia(s) (${acc.tokenExpiresAt.toISOString().slice(0, 10)}).`;
    const text =
      `${when}\n\n` +
      `Conta: ${acc.name}\n\n` +
      `Enquanto não reconectar, as publicações do LinkedIn vão falhar e ficar presas em "queued" ` +
      `(Instagram e Threads continuam normalmente).\n\n` +
      `Reconecte agora em:\n${baseUrl()}/settings\n\n` +
      `(O LinkedIn não fornece refresh token para este app, então a reconexão é manual a cada ~60 dias.)`;

    if (opts.dryRun) {
      warned.push({ name: acc.name, daysLeft, sent: false, reason: "dry-run" });
      continue;
    }

    if (!resendEnabled() || !process.env.NOTIFY_EMAIL) {
      warned.push({ name: acc.name, daysLeft, sent: false, reason: "RESEND_API_KEY/NOTIFY_EMAIL ausente" });
      continue;
    }

    try {
      await sendEmail({ to: process.env.NOTIFY_EMAIL, subject, text });
      await logEvent({
        event: REMINDER_EVENT,
        account: acc.personUrn,
        message: `Lembrete enviado: ${subject}`,
      });
      warned.push({ name: acc.name, daysLeft, sent: true });
    } catch (e) {
      warned.push({ name: acc.name, daysLeft, sent: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return { checked: accounts.length, warned };
}
