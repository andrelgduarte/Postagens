import { db } from "../lib/db/client";
import { posts as postsTable } from "../lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { deletePostBySlug } from "../lib/posts";
import { workerUserId } from "../lib/auth";

const DRY = !process.argv.includes("--apply");
const userArg = process.argv.find((a) => a.startsWith("--user="));
const USER_ID = userArg ? userArg.slice("--user=".length) : workerUserId();
const LIST_USERS = process.argv.includes("--list-users");

function baseOf(slug: string): string {
  return slug.replace(/-(\d+)$/, "");
}

async function main() {
  if (LIST_USERS) {
    const users = await db
      .select({ userId: postsTable.userId, count: sql<number>`count(*)::int` })
      .from(postsTable)
      .groupBy(postsTable.userId);
    console.log("userIds no banco (posts):");
    for (const u of users) console.log(`  ${u.userId}: ${u.count}`);
    return;
  }

  console.log(`user=${USER_ID} mode=${DRY ? "DRY-RUN" : "APPLY"}`);
  const rows = await db
    .select({ slug: postsTable.slug, id: postsTable.id, createdAt: postsTable.createdAt })
    .from(postsTable)
    .where(eq(postsTable.userId, USER_ID))
    .orderBy(asc(postsTable.createdAt));

  console.log(`posts do user: ${rows.length}`);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const b = baseOf(r.slug);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(r);
  }

  const toDelete: string[] = [];
  for (const [base, list] of groups) {
    if (list.length < 2) continue;
    const withBaseSlug = list.find((r) => r.slug === base);
    const keeper = withBaseSlug ?? list[0];
    const dupes = list.filter((r) => r.slug !== keeper.slug);
    if (dupes.length === 0) continue;
    console.log(`\ngrupo: ${base}`);
    console.log(`  KEEP: ${keeper.slug}`);
    for (const d of dupes) {
      console.log(`  DROP: ${d.slug}`);
      toDelete.push(d.slug);
    }
  }

  console.log(`\ntotal a deletar: ${toDelete.length}`);
  if (DRY) {
    console.log("dry-run, nada foi apagado. rode com --apply para executar.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const slug of toDelete) {
    try {
      const deleted = await deletePostBySlug(slug, USER_ID);
      if (deleted) {
        console.log(`✓ ${slug}`);
        ok++;
      } else {
        console.log(`⚠ ${slug} (não achado)`);
      }
    } catch (e) {
      console.log(`✗ ${slug}: ${e instanceof Error ? e.message : String(e)}`);
      fail++;
    }
  }
  console.log(`\nresumo: ${ok} apagado(s), ${fail} erro(s)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
