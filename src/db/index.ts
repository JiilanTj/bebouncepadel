import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { logger } from "../lib/logger.js";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error("DATABASE_URL is not defined");
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
});

pool.on("error", (err) => {
  logger.error({ error: err.message }, "Unexpected database error");
});

export const db = drizzle(pool, { schema });

export async function checkConnection(): Promise<boolean> {
  const timeoutMs = 3000;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout")), timeoutMs)
    );
    const checkPromise = (async () => {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
    })();

    await Promise.race([checkPromise, timeoutPromise]);
    logger.info("Database connection successful");
    return true;
  } catch (error) {
    logger.error({ error }, "Database connection failed");
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await pool.end();
  logger.info("Database connection closed");
}

export { pool, schema };
