import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import { leaderboardRepository } from "../repositories/leaderboard.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import { getLeaderboard, setLeaderboardOptIn } from "./leaderboard.service.js";

vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn() },
}));
vi.mock("../repositories/loyalty-transaction.repository.js", () => ({
  loyaltyTransactionRepository: { findEarnByReasonForGuest: vi.fn() },
}));
vi.mock("../repositories/leaderboard.repository.js", () => ({
  leaderboardRepository: { fetchEntries: vi.fn(), countParticipants: vi.fn() },
}));
vi.mock("./loyalty.service.js", () => ({ awardPoints: vi.fn() }));
vi.mock("./engagement.service.js", () => ({ scheduleLeaderboardSummary: vi.fn() }));

const guestRepo = vi.mocked(guestRepository);
const leaderboardRepo = vi.mocked(leaderboardRepository);

function makeGuest(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "g1", restaurantId: "r1", name: "Dana", phone: "+972500000000", email: null,
    language: "he", source: "web", visitCount: 0, noShowCount: 0, tier: "bronze",
    pointsBalance: 0, preferences: null, tags: null, notes: null, optedOutCampaigns: false,
    referralCode: null, referredBy: null, lastVisitDate: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  } as GuestRow;
}

describe("leaderboard.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getLeaderboard", () => {
    it("maps repository rows into ranked entries", async () => {
      leaderboardRepo.fetchEntries.mockResolvedValue([
        { guest_id: "g1", guest_name: "Dana", tier: "gold", visit_count: 20, points_earned: 300, rank: 1 },
      ]);
      leaderboardRepo.countParticipants.mockResolvedValue(5);

      const result = await getLeaderboard("r1", "2026-06", 10);

      expect(result.participantCount).toBe(5);
      expect(result.entries).toEqual([
        { guestId: "g1", guestName: "Dana", rank: 1, pointsEarned: 300, tier: "gold", visitCount: 20 },
      ]);
    });
  });

  describe("setLeaderboardOptIn", () => {
    it("returns null for an unknown guest", async () => {
      guestRepo.findById.mockResolvedValue(null);
      expect(await setLeaderboardOptIn("nope", "r1", true)).toBeNull();
      expect(guestRepo.updateById).not.toHaveBeenCalled();
    });

    it("writes the opt-in preference into guest preferences", async () => {
      guestRepo.findById.mockResolvedValue(makeGuest({ preferences: {} }));
      guestRepo.updateById.mockResolvedValue(makeGuest());

      const result = await setLeaderboardOptIn("g1", "r1", true);

      expect(result?.optedIn).toBe(true);
      expect(guestRepo.updateById).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({
          preferences: expect.objectContaining({ leaderboard: expect.objectContaining({ optedIn: true }) }),
        }),
      );
    });
  });
});
