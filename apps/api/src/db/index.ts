import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { env } from "../env.js";

const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

/**
 * A Drizzle transaction handle, derived from the `db.transaction` callback.
 * Repository methods accept `DB | DbTransaction` so the same code path runs
 * inside or outside a transaction.
 */
export type DbTransaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

export async function pingDatabase(): Promise<void> {
  await client`select 1`;
}
