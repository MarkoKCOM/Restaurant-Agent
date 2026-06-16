import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import { loyaltyTransactionRepository } from "../repositories/loyalty-transaction.repository.js";
import { rewardRepository } from "../repositories/reward.repository.js";
import { reservationRepository } from "../repositories/reservation.repository.js";
import { db } from "../db/index.js";
import type { LoyaltyTransactionRow } from "../repositories/loyalty-transaction.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import {
  awardPoints,
  deductPoints,
  evaluateTier,
  getTierMultiplier,
  onVisitCompleted,
} from "./loyalty.service.js";

vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn(), adjustPoints: vi.fn() },
}));
vi.mock("../repositories/loyalty-transaction.repository.js", () => ({
  loyaltyTransactionRepository: {
    insert: vi.fn(),
    findByGuest: vi.fn(),
    findEarnByReason: vi.fn(),
    findLuckySpinForVisit: vi.fn(),
  },
}));
vi.mock("../repositories/reward.repository.js", () => ({
  rewardRepository: {
    listByRestaurant: vi.fn(),
    findByIdInRestaurant: vi.fn(),
    findActiveById: vi.fn(),
    updateInRestaurant: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock("../repositories/reservation.repository.js", () => ({
  reservationRepository: { findVisitCompletionContext: vi.fn() },
}));
// db.transaction runs its callback with a sentinel tx so we can assert the
// executor is threaded into both repository writes.
vi.mock("../db/index.js", () => ({
  db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb("TX")) },
}));

const guestRepo = vi.mocked(guestRepository);
const txRepo = vi.mocked(loyaltyTransactionRepository);
const reservationRepo = vi.mocked(reservationRepository);
const dbMock = vi.mocked(db);

function makeTx(overrides: Partial<LoyaltyTransactionRow> = {}): LoyaltyTransactionRow {
  return {
    id: "tx1",
    restaurantId: "r1",
    guestId: "g1",
    type: "earn",
    points: 10,
    reason: "visit_completion",
    reservationId: "res1",
    createdAt: new Date(),
    ...overrides,
  } as LoyaltyTransactionRow;
}

function makeGuest(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "g1",
    restaurantId: "r1",
    name: "Dana",
    phone: "+972500000000",
    email: null,
    language: "he",
    source: "web",
    visitCount: 0,
    noShowCount: 0,
    tier: "bronze",
    pointsBalance: 0,
    preferences: null,
    tags: null,
    notes: null,
    optedOutCampaigns: false,
    referralCode: null,
    referredBy: null,
    lastVisitDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GuestRow;
}

describe("loyalty.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTierMultiplier reflects the tier table", () => {
    expect(getTierMultiplier("bronze")).toBe(1);
    expect(getTierMultiplier("silver")).toBe(1.5);
    expect(getTierMultiplier("gold")).toBe(2);
  });

  describe("awardPoints", () => {
    it("records an earn transaction and credits the guest balance", async () => {
      txRepo.insert.mockResolvedValue(makeTx({ points: 25, reason: "promo" }));

      await awardPoints("g1", "r1", 25, "promo");

      // Both writes receive the same transaction executor ("TX").
      expect(txRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: "earn", points: 25, reason: "promo" }),
        "TX",
      );
      expect(guestRepo.adjustPoints).toHaveBeenCalledWith("g1", 25, "TX");
    });

    it("performs the ledger insert and balance update inside one transaction", async () => {
      txRepo.insert.mockResolvedValue(makeTx());

      await awardPoints("g1", "r1", 10, "promo");

      expect(dbMock.transaction).toHaveBeenCalledOnce();
    });
  });

  describe("deductPoints", () => {
    it("throws when the balance is insufficient and writes nothing", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ pointsBalance: 5 }));

      await expect(deductPoints("g1", "r1", 50, "redeem")).rejects.toThrow(/Insufficient points/);
      expect(txRepo.insert).not.toHaveBeenCalled();
      expect(guestRepo.adjustPoints).not.toHaveBeenCalled();
    });

    it("records a negative redeem transaction and debits the balance", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ pointsBalance: 100 }));
      txRepo.insert.mockResolvedValue(makeTx({ type: "redeem", points: -30 }));

      await deductPoints("g1", "r1", 30, "redeem_reward:Wine");

      expect(txRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: "redeem", points: -30 }),
        "TX",
      );
      expect(guestRepo.adjustPoints).toHaveBeenCalledWith("g1", -30, "TX");
    });
  });

  describe("evaluateTier", () => {
    it("promotes a guest to gold at the visit threshold and persists it", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ tier: "bronze", visitCount: 15 }));

      const result = await evaluateTier("g1");

      expect(result).toEqual({ oldTier: "bronze", newTier: "gold", changed: true });
      expect(guestRepo.updateById).toHaveBeenCalledWith("g1", expect.objectContaining({ tier: "gold" }));
    });
  });

  describe("onVisitCompleted idempotency", () => {
    it("does not re-award visit points when a completion transaction already exists", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ tier: "bronze", visitCount: 3 }));
      reservationRepo.findVisitCompletionContext.mockResolvedValue({
        date: "2026-06-01",
        timeStart: "19:00",
        partySize: 2,
        dashboardConfig: {},
      });
      // visit_completion already recorded → idempotent
      txRepo.findEarnByReason.mockResolvedValue(makeTx({ reason: "visit_completion" }));
      txRepo.findLuckySpinForVisit.mockResolvedValue(null);

      const result = await onVisitCompleted("g1", "r1", "res1");

      // No new transactions written (no stamp/host/lucky on visitCount 3, party 2, no config)
      expect(txRepo.insert).not.toHaveBeenCalled();
      expect(result.visitPointsAwarded).toBe(10); // 10 * bronze(1) * offpeak(1)
    });
  });
});
