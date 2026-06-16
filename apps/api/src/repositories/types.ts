import { db } from "../db/index.js";
import type { DB, DbTransaction } from "../db/index.js";

/**
 * A database executor: either the shared connection pool (`db`) or an active
 * transaction handle (`tx`). Every repository method accepts an `Executor`
 * (defaulting to `db`) so callers can compose multiple repository calls inside
 * a single `db.transaction(...)` by threading the same `tx`.
 */
export type Executor = DB | DbTransaction;

/** Resolve an optional executor to the shared `db` instance when omitted. */
export function resolveExecutor(executor?: Executor): Executor {
  return executor ?? db;
}
