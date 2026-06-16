import { beforeEach, describe, expect, it, vi } from "vitest";
import { visitRepository } from "../repositories/visit.repository.js";
import type { VisitLogRow } from "../repositories/visit.repository.js";
import { getFeedbackSummary, getGuestSentimentHistory } from "./feedback.service.js";

vi.mock("../repositories/visit.repository.js", () => ({
  visitRepository: {
    findByGuestReservation: vi.fn(),
    updateById: vi.fn(),
    insert: vi.fn(),
    listByRestaurantInDateRange: vi.fn(),
    listRatedByGuest: vi.fn(),
  },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

const visitRepo = vi.mocked(visitRepository);

function makeVisit(overrides: Partial<VisitLogRow> = {}): VisitLogRow {
  return {
    id: "v1", restaurantId: "r1", guestId: "g1", reservationId: null, date: "2026-06-01",
    partySize: null, items: null, totalSpend: null, feedback: null, rating: null,
    sentiment: null, staffNotes: null, occasion: null, dietaryNotes: null, channel: null,
    createdAt: new Date(), ...overrides,
  } as VisitLogRow;
}

describe("feedback.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getFeedbackSummary", () => {
    it("aggregates average rating, sentiment breakdown, and recent complaints", async () => {
      visitRepo.listByRestaurantInDateRange.mockResolvedValue([
        makeVisit({ rating: 5, sentiment: "positive", feedback: "great" }),
        makeVisit({ rating: 1, sentiment: "negative", feedback: "bad" }),
        makeVisit({ rating: 3, sentiment: "neutral" }),
      ]);

      const summary = await getFeedbackSummary("r1");

      expect(visitRepo.listByRestaurantInDateRange).toHaveBeenCalledWith("r1", undefined, undefined);
      expect(summary.averageRating).toBe(3);
      expect(summary.sentimentBreakdown).toEqual({ positive: 1, neutral: 1, negative: 1 });
      expect(summary.recentComplaints).toHaveLength(1);
      expect(summary.recentComplaints[0].rating).toBe(1);
    });

    it("passes the date range through to the repository", async () => {
      visitRepo.listByRestaurantInDateRange.mockResolvedValue([]);

      await getFeedbackSummary("r1", { from: "2026-06-01", to: "2026-06-30" });

      expect(visitRepo.listByRestaurantInDateRange).toHaveBeenCalledWith("r1", "2026-06-01", "2026-06-30");
    });
  });

  describe("getGuestSentimentHistory", () => {
    it("returns the guest's rated visits from the repository", async () => {
      visitRepo.listRatedByGuest.mockResolvedValue([makeVisit({ rating: 4, sentiment: "positive" })]);

      const history = await getGuestSentimentHistory("g1");

      expect(visitRepo.listRatedByGuest).toHaveBeenCalledWith("g1");
      expect(history).toHaveLength(1);
    });
  });
});
