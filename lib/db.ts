import { Pool } from "pg";
import { env } from "./env";

const globalForPg = globalThis as unknown as {
  pool?: Pool;
};

export const db =
  globalForPg.pool ??
  new Pool({
    connectionString: env.databaseUrl
  });

if (!globalForPg.pool) {
  globalForPg.pool = db;
}
