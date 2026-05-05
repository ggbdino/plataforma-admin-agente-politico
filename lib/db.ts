import { Pool } from "pg";
import { getRequiredEnv } from "./env";

const globalForPg = globalThis as unknown as {
  pool?: Pool;
};

export const db =
  globalForPg.pool ??
  new Pool({
    connectionString: getRequiredEnv("DATABASE_URL")
  });

if (!globalForPg.pool) {
  globalForPg.pool = db;
}
