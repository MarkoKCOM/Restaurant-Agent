import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import { awardVisitAchievements } from "./achievement.service.js";

vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

const guestRepo = vi.mocked(guestRepository);

function makeGuest(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "g1",
    restaurantId: "r1",
    name: "Dana",
    phone: "+972500000000",
    email: null,
    language: "he",
    source: "web",
    visitCount: 1,
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

describe("achievement.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null and writes nothing when the guest does not exist", async () => {
    guestRepo.findById.mockResolvedValue(null);

    expect(await awardVisitAchievements("missing")).toBeNull();
    expect(guestRepo.updateById).not.toHaveBeenCalled();
  });

  it("persists updated preferences when achievements change", async () => {
    guestRepo.findById.mockResolvedValue(makeGuest({ visitCount: 1, preferences: null }));
    guestRepo.updateById.mockResolvedValue(makeGuest());

    const result = await awardVisitAchievements("g1", { visitCount: 1 });

    // A first visit unlocks at least one achievement → preferences are written back.
    expect(guestRepo.updateById).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({ preferences: expect.any(Object) }),
    );
    expect(result).not.toBeNull();
  });
});
