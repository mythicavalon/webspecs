import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export function createPostgresDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to create a PostgreSQL WebSpecs database.",
    );
  }
  const pool = new Pool({ connectionString });
  return { pool, db: drizzle(pool, { schema }) };
}

export const postgres = process.env.DATABASE_URL
  ? createPostgresDatabase(process.env.DATABASE_URL)
  : undefined;
export const pool = postgres?.pool;
export const db = postgres?.db;

export * from "./schema";
