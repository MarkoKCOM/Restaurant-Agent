import { beforeEach, describe, expect, it, vi } from "vitest";
import { reservationRepository } from "../repositories/reservation.repository.js";
import { restaurantRepository } from "../repositories/restaurant.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import type { ReservationRow } from "../repositories/reservation.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import {
  assertValidTransition,
  checkAvailability,
  listReservations,
} from "./reservation.service.js";

vi.mock("../repositories/reservation.repository.js", () => ({
  reservationRepository: {
    findByDay: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    updateById: vi.fn(),
  },
}));
vi.mock("../repositories/restaurant.repository.js", () => ({
  restaurantRepository: { findById: vi.fn() },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: {
    findByPhone: vi.fn(),
    listByRestaurant: vi.fn(),
    listAll: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    updateById: vi.fn(),
    incrementNoShowCount: vi.fn(),
    incrementVisitCount: vi.fn(),
  },
}));

const reservationRepo = vi.mocked(reservationRepository);
const restaurantRepo = vi.mocked(restaurantRepository);
const guestRepo = vi.mocked(guestRepository);

function makeReservation(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: "res1",
    restaurantId: "r1",
    guestId: "g1",
    date: "2026-07-01",
    timeStart: "19:00",
    timeEnd: "21:00",
    partySize: 2,
    tableIds: ["t1"],
    status: "confirmed",
    source: "web",
    notes: null,
    cancellationReason: null,
    confirmedAt: new Date(),
    seatedAt: null,
    completedAt: null,
    cancelledAt: null,
    noShowAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ReservationRow;
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

describe("reservation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertValidTransition", () => {
    it("allows a permitted transition", () => {
      expect(() => assertValidTransition("confirmed", "seated")).not.toThrow();
    });

    it("treats a no-op (same status) as valid", () => {
      expect(() => assertValidTransition("seated", "seated")).not.toThrow();
    });

    it("rejects an illegal transition with a 409", () => {
      try {
        assertValidTransition("completed", "seated");
        throw new Error("expected throw");
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(409);
      }
    });
  });

  describe("checkAvailability", () => {
    it("returns no slots when the restaurant does not exist", async () => {
      restaurantRepo.findById.mockResolvedValue(null);

      const slots = await checkAvailability({
        restaurantId: "missing",
        date: "2026-07-01",
        partySize: 2,
      } as Parameters<typeof checkAvailability>[0]);

      expect(restaurantRepo.findById).toHaveBeenCalledWith("missing");
      expect(slots).toEqual([]);
    });
  });

  describe("listReservations", () => {
    it("attaches each reservation's guest from the restaurant guest list", async () => {
      reservationRepo.list.mockResolvedValue([makeReservation()]);
      guestRepo.listByRestaurant.mockResolvedValue([makeGuest()]);

      const result = await listReservations({ restaurantId: "r1" });

      expect(reservationRepo.list).toHaveBeenCalledWith({ restaurantId: "r1", date: undefined });
      expect(guestRepo.listByRestaurant).toHaveBeenCalledWith("r1");
      expect(result[0].guest?.id).toBe("g1");
    });

    it("does not fetch guests when no restaurantId is provided", async () => {
      reservationRepo.list.mockResolvedValue([]);

      await listReservations({});

      expect(guestRepo.listByRestaurant).not.toHaveBeenCalled();
    });
  });
});
