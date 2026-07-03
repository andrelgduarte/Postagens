import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
const UID = "user_3FGh29qmsB3VcOGjO62SBGZZm15";
async function main() {
  const slugs = [
    "2026-06-18-a-coragem-tambem-sussurra",
    "2026-06-19-na-timidez-mora-a-escuta-que-transforma",
    "2026-06-20-lancamento-o-livro",
    "2026-06-25-o-medo-de-errar-te-fez-preparado",
    "2026-06-30-escreva-antes-de-falar",
  ];
  const rows = await db.execute(sql`
    SELECT p.slug, p.scheduled::text, p.status_th, p.status_ig, p.status_li, p.type, p.attempts, p.last_error,
           (SELECT COUNT(*) FROM media m WHERE m.post_id = p.id) as media_count,
           (SELECT string_agg(kind || ':' || filename, ', ') FROM media m WHERE m.post_id = p.id) as media_list,
           (SELECT content FROM captions c WHERE c.post_id = p.id AND c.network = 'th') as th_caption
    FROM posts p
    WHERE user_id = ${UID} AND slug = ANY(ARRAY[${sql.join(slugs.map(s => sql`${s}`), sql`, `)}])
    ORDER BY slug
  `);
  for (const r of rows.rows) console.log(r);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
