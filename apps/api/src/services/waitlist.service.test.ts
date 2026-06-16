import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitlistRepository } from "../repositories/waitlist.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import type { WaitlistRow } from "../repositories/waitlist.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import {
  cancelWaitlistEntry,
  expireStaleOffers,
  listWaitlist,
  matchWaitlist,
} from "./waitlist.service.js";

vi.mock("../repositories/waitlist.repository.js", () => ({
  waitlistRepository: {
    insert: vi.fn(),
    listByRestaurant: vi.fn(),
    findWaitingForDay: vi.fn(),
    findById: vi.fn(),
    updateById: vi.fn(),
    expireOffersBefore: vi.fn(),
  },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: {
    listByRestaurant: vi.fn(),
    findById: vi.fn(),
  },
}));

const waitlistRepo = vi.mocked(waitlistRepository);
const guestRepo = vi.mocked(guestRepository);

function makeWaitlist(overrides: Partial<WaitlistRow> = {}): WaitlistRow {
  return {
    id: "w1",
    restaurantId: "r1",
    guestId: "g1",
    date: "2026-07-01",
    preferredTimeStart: "19:00",
    preferredTimeEnd: "21:00",
    partySize: 2,
    status: "waiting",
    offeredAt: null,
    expiresAt: null,
    createdAt: new Date(),
    ...overrides,
  } as WaitlistRow;
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

describe("waitlist.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listWaitlist", () => {
    it("joins entries to their guests and drops entries with no matching guest", async () => {
      waitlistRepo.listByRestaurant.mockResolvedValue([
        makeWaitlist({ id: "w1", guestId: "g1" }),
        makeWaitlist({ id: "w2", guestId: "ghost" }),
      ]);
      guestRepo.listByRestaurant.mockResolvedValue([makeGuest({ id: "g1" })]);

      const result = await listWaitlist("r1", "2026-07-01");

      expect(waitlistRepo.listByRestaurant).toHaveBeenCalledWith("r1", "2026-07-01");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
      expect(result[0].guestName).toBe("Dana");
    });
  });

  describe("matchWaitlist", () => {
    it("returns only entries whose time overlaps and party fits the freed slot", async () => {
      waitlistRepo.findWaitingForDay.mockResolvedValue([
        makeWaitlist({ id: "fits", partySize: 2, preferredTimeStart: "19:00", preferredTimeEnd: "21:00" }),
        makeWaitlist({ id: "too-big", partySize: 8, preferredTimeStart: "19:00", preferredTimeEnd: "21:00" }),
        makeWaitlist({ id: "no-overlap", partySize: 2, preferredTimeStart: "12:00", preferredTimeEnd: "13:00" }),
      ]);
      guestRepo.listByRestaurant.mockResolvedValue([makeGuest({ id: "g1" })]);

      const matches = await matchWaitlist("r1", "2026-07-01", "19:30", "20:30", 4);

      expect(matches.map((m) => m.id)).toEqual(["fits"]);
    });
  });

  describe("expireStaleOffers", () => {
    it("delegates to the repository bulk-expire", async () => {
      waitlistRepo.expireOffersBefore.mockResolvedValue(3);

      const count = await expireStaleOffers();

      expect(waitlistRepo.expireOffersBefore).toHaveBeenCalledWith(expect.any(Date));
      expect(count).toBe(3);
    });
  });

  describe("cancelWaitlistEntry", () => {
    it("returns null when the entry does not exist", async () => {
      waitlistRepo.updateById.mockResolvedValue(null);

      expect(await cancelWaitlistEntry("missing")).toBeNull();
      expect(guestRepo.findById).not.toHaveBeenCalled();
    });

    it("expires the entry and returns it with guest details", async () => {
      waitlistRepo.updateById.mockResolvedValue(makeWaitlist({ status: "expired" }));
      guestRepo.findById.mockResolvedValue(makeGuest());

      const result = await cancelWaitlistEntry("w1");

      expect(waitlistRepo.updateById).toHaveBeenCalledWith("w1", { status: "expired" });
      expect(result?.status).toBe("expired");
      expect(result?.guestPhone).toBe("+972500000000");
    });
  });
});
