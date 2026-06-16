import { beforeEach, describe, expect, it, vi } from "vitest";
import { visitRepository } from "../repositories/visit.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { reservationRepository } from "../repositories/reservation.repository.js";
import type { VisitLogRow } from "../repositories/visit.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import { getGuestInsights, getVisitHistory, logVisit } from "./visit.service.js";

vi.mock("../repositories/visit.repository.js", () => ({
  visitRepository: { insert: vi.fn(), findByGuest: vi.fn() },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn() },
}));
vi.mock("../repositories/reservation.repository.js", () => ({
  reservationRepository: { findByGuest: vi.fn() },
}));

const visitRepo = vi.mocked(visitRepository);
const guestRepo = vi.mocked(guestRepository);
const reservationRepo = vi.mocked(reservationRepository);

function makeVisit(overrides: Partial<VisitLogRow> = {}): VisitLogRow {
  return {
    id: "v1",
    restaurantId: "r1",
    guestId: "g1",
    reservationId: null,
    date: "2026-06-01",
    partySize: 2,
    items: null,
    totalSpend: null,
    feedback: null,
    rating: null,
    sentiment: null,
    staffNotes: null,
    occasion: null,
    dietaryNotes: null,
    channel: null,
    createdAt: new Date(),
    ...overrides,
  } as VisitLogRow;
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
    visitCount: 3,
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
    firstVisitDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GuestRow;
}

describe("visit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVisitHistory", () => {
    it("delegates to the repository with the limit", async () => {
      visitRepo.findByGuest.mockResolvedValue([makeVisit()]);

      await getVisitHistory("g1", 5);

      expect(visitRepo.findByGuest).toHaveBeenCalledWith("g1", { limit: 5 });
    });
  });

  describe("logVisit", () => {
    it("inserts the visit and increments the guest's visit count", async () => {
      const visit = makeVisit();
      visitRepo.insert.mockResolvedValue(visit);
      guestRepo.findById.mockResolvedValue(makeGuest({ visitCount: 3, firstVisitDate: "2026-01-01" }));
      guestRepo.updateById.mockResolvedValue(makeGuest());

      const result = await logVisit({ restaurantId: "r1", guestId: "g1", date: "2026-06-02" });

      expect(visitRepo.insert).toHaveBeenCalledOnce();
      expect(guestRepo.updateById).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ visitCount: 4, lastVisitDate: "2026-06-02" }),
      );
      expect(result).toBe(visit);
    });

    it("stamps firstVisitDate when the guest has none", async () => {
      visitRepo.insert.mockResolvedValue(makeVisit());
      guestRepo.findById.mockResolvedValue(makeGuest({ firstVisitDate: null }));
      guestRepo.updateById.mockResolvedValue(makeGuest());

      await logVisit({ restaurantId: "r1", guestId: "g1", date: "2026-06-02" });

      expect(guestRepo.updateById).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ firstVisitDate: "2026-06-02" }),
      );
    });
  });

  describe("getGuestInsights", () => {
    it("aggregates spend, rating, and favorite items across visits", async () => {
      visitRepo.findByGuest.mockResolvedValue([
        makeVisit({ totalSpend: 10000, rating: 5, items: [{ name: "Pizza" }] as unknown as VisitLogRow["items"] }),
        makeVisit({ totalSpend: 20000, rating: 3, items: [{ name: "Pizza" }] as unknown as VisitLogRow["items"] }),
      ]);
      reservationRepo.findByGuest.mockResolvedValue([]);

      const insights = await getGuestInsights("g1");

      expect(insights.totalVisits).toBe(2);
      expect(insights.totalSpend).toBe(30000);
      expect(insights.averageSpend).toBe(15000);
      expect(insights.averageRating).toBe(4);
      expect(insights.favoriteItems[0]).toEqual({ name: "Pizza", count: 2 });
    });
  });
});
