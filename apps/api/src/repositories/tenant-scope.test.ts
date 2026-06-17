import { describe, it, expect } from "vitest";
import { db } from "../db/index.js";
import { guests, reservations } from "../db/schema.js";
import { guestRepository } from "./guest.repository.js";
import { reservationRepository } from "./reservation.repository.js";
import { runWithTenant } from "../context/tenant-context.js";
import type { Executor } from "./types.js";

/**
 * These tests prove the by-PK repository methods apply the active tenant filter.
 * A capturing fake executor records the `where(...)` condition each method
 * builds; we then render it with drizzle's `toSQL()` (no DB connection needed)
 * and assert the active restaurantId is — or is not — bound as a parameter.
 */
function capturingExecutor(rows: unknown[]) {
  let captured: unknown;
  const exec = {
    select: () => exec,
    from: () => exec,
    where: (cond: unknown) => {
      captured = cond;
      return exec;
    },
    limit: () => Promise.resolve(rows),
    update: () => exec,
    set: () => exec,
    returning: () => Promise.resolve(rows),
  };
  return { exec: exec as unknown as Executor, getWhere: () => captured };
}

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const FOREIGN_ID = "22222222-2222-2222-2222-222222222222";

describe("by-PK repository tenant scoping", () => {
  it("guest.findById filters by the active tenant restaurantId", async () => {
    const { exec, getWhere } = capturingExecutor([]);
    const row = await runWithTenant(
      { restaurantId: TENANT_A, role: "admin", bypass: false },
      () => guestRepository.findById(FOREIGN_ID, exec),
    );

    // A foreign-tenant id matches no row under the scoped query.
    expect(row).toBeNull();

    const { params } = db.select().from(guests).where(getWhere() as never).toSQL();
    expect(params).toContain(TENANT_A);
    expect(params).toContain(FOREIGN_ID);
  });

  it("guest.updateById filters by the active tenant restaurantId", async () => {
    const { exec, getWhere } = capturingExecutor([]);
    const row = await runWithTenant(
      { restaurantId: TENANT_A, role: "admin", bypass: false },
      () => guestRepository.updateById(FOREIGN_ID, { name: "x" }, exec),
    );

    expect(row).toBeNull();
    const { params } = db.select().from(guests).where(getWhere() as never).toSQL();
    expect(params).toContain(TENANT_A);
  });

  it("reservation.findById filters by the active tenant restaurantId", async () => {
    const { exec, getWhere } = capturingExecutor([]);
    await runWithTenant(
      { restaurantId: TENANT_A, role: "admin", bypass: false },
      () => reservationRepository.findById(FOREIGN_ID, exec),
    );

    const { params } = db.select().from(reservations).where(getWhere() as never).toSQL();
    expect(params).toContain(TENANT_A);
  });

  it("does not scope under a super_admin/system bypass context", async () => {
    const { exec, getWhere } = capturingExecutor([]);
    await runWithTenant(
      { restaurantId: null, role: "super_admin", bypass: true },
      () => guestRepository.findById(FOREIGN_ID, exec),
    );

    const { params } = db.select().from(guests).where(getWhere() as never).toSQL();
    expect(params).not.toContain(TENANT_A);
    expect(params).toContain(FOREIGN_ID);
  });

  it("does not scope when no tenant context is set", async () => {
    const { exec, getWhere } = capturingExecutor([]);
    await guestRepository.findById(FOREIGN_ID, exec);

    const { params } = db.select().from(guests).where(getWhere() as never).toSQL();
    expect(params).toEqual([FOREIGN_ID]);
  });
});
