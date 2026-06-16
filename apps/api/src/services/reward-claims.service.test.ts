import { beforeEach, describe, expect, it, vi } from "vitest";
import { rewardClaimRepository } from "../repositories/reward-claim.repository.js";
import { rewardRepository } from "../repositories/reward.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import type { RewardClaimRow } from "../repositories/reward-claim.repository.js";
import { getGuestClaims, redeemClaim, verifyClaimByCode } from "./reward-claims.service.js";

vi.mock("../repositories/reward-claim.repository.js", () => ({
  rewardClaimRepository: {
    insert: vi.fn(),
    findByCode: vi.fn(),
    findById: vi.fn(),
    updateById: vi.fn(),
    findByGuest: vi.fn(),
  },
}));
vi.mock("../repositories/reward.repository.js", () => ({
  rewardRepository: { findActiveById: vi.fn(), findById: vi.fn(), findByIds: vi.fn() },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn() },
}));
vi.mock("./loyalty.service.js", () => ({ deductPoints: vi.fn() }));

const claimRepo = vi.mocked(rewardClaimRepository);
const rewardRepo = vi.mocked(rewardRepository);
const guestRepo = vi.mocked(guestRepository);

function makeClaim(overrides: Partial<RewardClaimRow> = {}): RewardClaimRow {
  return {
    id: "c1",
    restaurantId: "r1",
    guestId: "g1",
    rewardId: "rw1",
    loyaltyTransactionId: "tx1",
    claimCode: "ABCD2345",
    status: "active",
    reservationId: null,
    redeemedAt: null,
    redeemedBy: null,
    claimedAt: new Date(),
    ...overrides,
  } as RewardClaimRow;
}

describe("reward-claims.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyClaimByCode", () => {
    it("returns null for an unknown code", async () => {
      claimRepo.findByCode.mockResolvedValue(null);
      expect(await verifyClaimByCode("zzzz")).toBeNull();
    });

    it("uppercases the code and joins reward + guest names", async () => {
      claimRepo.findByCode.mockResolvedValue(makeClaim());
      rewardRepo.findById.mockResolvedValue({ nameHe: "יין" } as never);
      guestRepo.findById.mockResolvedValue({ name: "Dana" } as never);

      const result = await verifyClaimByCode("abcd2345");

      expect(claimRepo.findByCode).toHaveBeenCalledWith("ABCD2345");
      expect(result?.rewardName).toBe("יין");
      expect(result?.guestName).toBe("Dana");
    });
  });

  describe("redeemClaim", () => {
    it("rejects a claim that is not active", async () => {
      claimRepo.findById.mockResolvedValue(makeClaim({ status: "redeemed" }));
      await expect(redeemClaim("c1", "admin1")).rejects.toThrow(/already redeemed/);
      expect(claimRepo.updateById).not.toHaveBeenCalled();
    });

    it("marks an active claim redeemed", async () => {
      claimRepo.findById.mockResolvedValue(makeClaim({ status: "active" }));
      claimRepo.updateById.mockResolvedValue(makeClaim({ status: "redeemed" }));

      const result = await redeemClaim("c1", "admin1");

      expect(claimRepo.updateById).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ status: "redeemed", redeemedBy: "admin1" }),
      );
      expect(result.status).toBe("redeemed");
    });
  });

  describe("getGuestClaims", () => {
    it("returns [] when the guest has no claims", async () => {
      claimRepo.findByGuest.mockResolvedValue([]);
      expect(await getGuestClaims("g1")).toEqual([]);
      expect(rewardRepo.findByIds).not.toHaveBeenCalled();
    });

    it("maps reward names onto each claim", async () => {
      claimRepo.findByGuest.mockResolvedValue([makeClaim({ rewardId: "rw1" })]);
      rewardRepo.findByIds.mockResolvedValue([{ id: "rw1", nameHe: "קינוח" }] as never);

      const result = await getGuestClaims("g1");

      expect(rewardRepo.findByIds).toHaveBeenCalledWith(["rw1"]);
      expect(result[0].rewardName).toBe("קינוח");
    });
  });
});
