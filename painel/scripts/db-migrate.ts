import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurado");
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  console.log("migrating…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("ok");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
