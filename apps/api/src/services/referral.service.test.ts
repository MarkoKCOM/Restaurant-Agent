import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import { loyaltyTransactionRepository } from "../repositories/loyalty-transaction.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import { applyReferral, generateReferralCode, getReferralStats } from "./referral.service.js";

vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: {
    findById: vi.fn(),
    findByReferralCode: vi.fn(),
    findByReferredBy: vi.fn(),
    updateById: vi.fn(),
  },
}));
vi.mock("../repositories/loyalty-transaction.repository.js", () => ({
  loyaltyTransactionRepository: { listByGuestAndReason: vi.fn() },
}));
vi.mock("./loyalty.service.js", () => ({ awardPoints: vi.fn() }));

const guestRepo = vi.mocked(guestRepository);
const txRepo = vi.mocked(loyaltyTransactionRepository);

function makeGuest(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "g1", restaurantId: "r1", name: "Dana", phone: "+972500000000", email: null,
    language: "he", source: "web", visitCount: 0, noShowCount: 0, tier: "bronze",
    pointsBalance: 0, preferences: null, tags: null, notes: null, optedOutCampaigns: false,
    referralCode: null, referredBy: null, lastVisitDate: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  } as GuestRow;
}

describe("referral.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateReferralCode", () => {
    it("returns the existing code without writing", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ referralCode: "EXISTING1" }));
      expect(await generateReferralCode("g1")).toBe("EXISTING1");
      expect(guestRepo.updateById).not.toHaveBeenCalled();
    });

    it("generates and persists a code when none exists", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ referralCode: null }));
      guestRepo.findByReferralCode.mockResolvedValue(null);

      const code = await generateReferralCode("g1");

      expect(code).toHaveLength(8);
      expect(guestRepo.updateById).toHaveBeenCalledWith(
        "g1", expect.objectContaining({ referralCode: code }),
      );
    });
  });

  describe("applyReferral", () => {
    it("rejects an invalid code", async () => {
      guestRepo.findByReferralCode.mockResolvedValue(null);
      await expect(applyReferral("new1", "BADCODE")).rejects.toThrow(/Invalid referral code/);
    });

    it("rejects self-referral", async () => {
      guestRepo.findByReferralCode.mockResolvedValue(makeGuest({ id: "g1", referralCode: "CODE" }));
      await expect(applyReferral("g1", "CODE")).rejects.toThrow(/Cannot refer yourself/);
    });
  });

  describe("getReferralStats", () => {
    it("counts referred guests and sums referral-bonus points", async () => {
      guestRepo.findByReferredBy.mockResolvedValue([makeGuest({ id: "a" }), makeGuest({ id: "b" })]);
      txRepo.listByGuestAndReason.mockResolvedValue([
        { points: 50 } as never, { points: 50 } as never,
      ]);

      const stats = await getReferralStats("g1");

      expect(stats.referralCount).toBe(2);
      expect(stats.totalPointsEarned).toBe(100);
      expect(txRepo.listByGuestAndReason).toHaveBeenCalledWith("g1", "referral_bonus");
    });
  });
});
