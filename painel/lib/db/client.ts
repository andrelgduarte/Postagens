import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurado em .env.local");
  return new Pool({ connectionString: url, max: 5 });
}

export const pool = globalThis.__pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
