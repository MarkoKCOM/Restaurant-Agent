import { beforeEach, describe, expect, it, vi } from "vitest";
import { reservationRepository } from "../repositories/reservation.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { restaurantRepository } from "../repositories/restaurant.repository.js";
import { getDailySummary, getOwnerDeliveryContact } from "./summary.service.js";

vi.mock("../repositories/reservation.repository.js", () => ({
  reservationRepository: { findByDay: vi.fn() },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { listByRestaurant: vi.fn() },
}));
vi.mock("../repositories/restaurant.repository.js", () => ({
  restaurantRepository: { findById: vi.fn() },
}));
vi.mock("../repositories/waitlist.repository.js", () => ({
  waitlistRepository: { findWaitingForDay: vi.fn() },
}));

const reservationRepo = vi.mocked(reservationRepository);
const guestRepo = vi.mocked(guestRepository);
const restaurantRepo = vi.mocked(restaurantRepository);

describe("summary.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getOwnerDeliveryContact", () => {
    it("resolves the owner WhatsApp as the preferred recipient", async () => {
      restaurantRepo.findById.mockResolvedValue({
        ownerWhatsapp: "+972500000000", ownerPhone: null, whatsappNumber: null, phone: null,
      } as never);

      const contact = await getOwnerDeliveryContact("r1");

      expect(contact.source).toBe("ownerWhatsapp");
      expect(contact.recipientConfigured).toBe(true);
      expect(contact.ownerWhatsappConfigured).toBe(true);
    });

    it("throws when the restaurant is missing", async () => {
      restaurantRepo.findById.mockResolvedValue(null);
      await expect(getOwnerDeliveryContact("nope")).rejects.toThrow(/Restaurant not found/);
    });
  });

  describe("getDailySummary", () => {
    it("counts active reservations and covers for the day", async () => {
      reservationRepo.findByDay.mockResolvedValue([
        { id: "a", guestId: "g1", status: "confirmed", partySize: 2, timeStart: "19:00", timeEnd: "21:00" },
        { id: "b", guestId: "g2", status: "cancelled", partySize: 4, timeStart: "20:00", timeEnd: "22:00" },
        { id: "c", guestId: "g1", status: "completed", partySize: 3, timeStart: "18:00", timeEnd: "20:00" },
      ] as never);
      guestRepo.listByRestaurant.mockResolvedValue([
        { id: "g1", name: "Dana", visitCount: 5 }, { id: "g2", name: "Ron", visitCount: 1 },
      ] as never);

      const summary = await getDailySummary("r1", "2026-07-01");

      expect(reservationRepo.findByDay).toHaveBeenCalledWith("r1", "2026-07-01");
      // active = confirmed + completed (cancelled excluded)
      expect(summary.totalReservations).toBe(2);
      expect(summary.totalCovers).toBe(5);
      expect(summary.completedCount).toBe(1);
      expect(summary.cancelledCount).toBe(1);
    });
  });
});
