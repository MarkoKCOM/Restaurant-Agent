import { beforeEach, describe, expect, it, vi } from "vitest";
import { campaignRepository } from "../repositories/campaign.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { visitRepository } from "../repositories/visit.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import { deliverCampaign, previewCampaignAudience } from "./campaign.service.js";

vi.mock("../repositories/campaign.repository.js", () => ({
  campaignRepository: {
    insert: vi.fn(),
    findByIdInRestaurant: vi.fn(),
    listByRestaurantExcluding: vi.fn(),
    updateById: vi.fn(),
  },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { listByRestaurantRecentFirst: vi.fn() },
}));
vi.mock("../repositories/visit.repository.js", () => ({
  visitRepository: { findByRestaurant: vi.fn() },
}));

const campaignRepo = vi.mocked(campaignRepository);
const guestRepo = vi.mocked(guestRepository);
const visitRepo = vi.mocked(visitRepository);

function makeGuest(overrides: Partial<GuestRow> = {}): GuestRow {
  return {
    id: "g1",
    restaurantId: "r1",
    name: "Dana",
    phone: "+972500000000",
    email: null,
    language: "he",
    source: "web",
    visitCount: 5,
    noShowCount: 0,
    tier: "silver",
    pointsBalance: 0,
    preferences: null,
    tags: [],
    notes: null,
    optedOutCampaigns: false,
    referralCode: null,
    referredBy: null,
    lastVisitDate: "2026-05-01",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GuestRow;
}

describe("campaign.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitRepo.findByRestaurant.mockResolvedValue([]);
  });

  describe("previewCampaignAudience", () => {
    it("matches by minVisits and excludes opted-out guests", async () => {
      guestRepo.listByRestaurantRecentFirst.mockResolvedValue([
        makeGuest({ id: "keep", visitCount: 5, optedOutCampaigns: false }),
        makeGuest({ id: "too-few", visitCount: 1 }),
        makeGuest({ id: "opted-out", visitCount: 9, optedOutCampaigns: true }),
      ]);

      const preview = await previewCampaignAudience({
        restaurantId: "r1",
        filter: { minVisits: 3 },
      });

      expect(preview.totalGuests).toBe(3);
      expect(preview.matchedCount).toBe(1);
      expect(preview.excludedOptedOut).toBe(1);
      expect(preview.sample[0].guestId).toBe("keep");
    });
  });

  describe("deliverCampaign", () => {
    it("skips opted-out recipients and sends to the rest", async () => {
      campaignRepo.findByIdInRestaurant.mockResolvedValue({
        id: "c1", restaurantId: "r1", status: "scheduled", templateText: "Hi {{guest_name}}",
        audienceFilter: {}, stats: {},
      } as never);
      campaignRepo.listByRestaurantExcluding.mockResolvedValue([]);
      campaignRepo.updateById.mockImplementation((_id, updates) =>
        Promise.resolve({ id: "c1", ...updates } as never));
      guestRepo.listByRestaurantRecentFirst.mockResolvedValue([
        makeGuest({ id: "sendable", optedOutCampaigns: false }),
        makeGuest({ id: "opted", optedOutCampaigns: true }),
      ]);

      const result = await deliverCampaign({ campaignId: "c1", restaurantId: "r1" });

      expect(result.delivery.sent).toBe(1);
      expect(result.delivery.skippedOptedOut).toBe(1);
      const sent = result.recipients.find((r) => r.status === "sent");
      expect(sent?.guestId).toBe("sendable");
    });

    it("rejects delivery from a non-draft/scheduled status", async () => {
      campaignRepo.findByIdInRestaurant.mockResolvedValue({
        id: "c1", restaurantId: "r1", status: "sent", audienceFilter: {}, stats: {},
      } as never);

      await expect(deliverCampaign({ campaignId: "c1", restaurantId: "r1" }))
        .rejects.toThrow(/cannot be delivered/);
    });
  });
});
