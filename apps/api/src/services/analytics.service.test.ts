import { beforeEach, describe, expect, it, vi } from "vitest";
import { reservationRepository } from "../repositories/reservation.repository.js";
import { tableRepository } from "../repositories/table.repository.js";
import { getReservationAnalytics } from "./analytics.service.js";

vi.mock("../repositories/reservation.repository.js", () => ({
  reservationRepository: { list: vi.fn() },
}));
vi.mock("../repositories/table.repository.js", () => ({
  tableRepository: { findByRestaurant: vi.fn() },
}));
vi.mock("../repositories/guest.repository.js", () => ({ guestRepository: { listByRestaurant: vi.fn() } }));
vi.mock("../repositories/visit.repository.js", () => ({ visitRepository: { findByRestaurant: vi.fn() } }));
vi.mock("../repositories/loyalty-transaction.repository.js", () => ({ loyaltyTransactionRepository: { listByRestaurantInRange: vi.fn() } }));
vi.mock("../repositories/reward-claim.repository.js", () => ({ rewardClaimRepository: { listByRestaurantInRange: vi.fn() } }));
vi.mock("../repositories/campaign.repository.js", () => ({ campaignRepository: { listForAnalytics: vi.fn() } }));

const reservationRepo = vi.mocked(reservationRepository);
const tableRepo = vi.mocked(tableRepository);

describe("analytics.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getReservationAnalytics", () => {
    it("summarizes bookings, covers, and cancellations within the period", async () => {
      reservationRepo.list.mockResolvedValue([
        { id: "a", date: "2026-06-15", status: "completed", partySize: 2, timeStart: "19:00" },
        { id: "b", date: "2026-06-16", status: "cancelled", partySize: 4, timeStart: "20:00" },
        { id: "c", date: "2026-06-17", status: "confirmed", partySize: 3, timeStart: "18:00" },
      ] as never);
      tableRepo.findByRestaurant.mockResolvedValue([
        { id: "t1", isActive: true, maxSeats: 4 }, { id: "t2", isActive: true, maxSeats: 6 },
      ] as never);

      const result = await getReservationAnalytics({
        restaurantId: "r1", from: "2026-06-01", to: "2026-06-30",
      });

      expect(reservationRepo.list).toHaveBeenCalledWith({ restaurantId: "r1" });
      expect(result.capacity.activeSeats).toBe(10);
      expect(result.current.bookings).toBe(3);
      expect(result.current.activeBookings).toBe(2); // cancelled excluded
      expect(result.current.cancellations).toBe(1);
      expect(result.current.covers).toBe(5); // 2 + 3
    });
  });
});
