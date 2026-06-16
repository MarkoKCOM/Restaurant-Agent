import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import type { GuestRow } from "../repositories/guest.repository.js";
import {
  findOrCreateGuest,
  getGuestById,
  listGuests,
  updateGuestPreferences,
} from "./guest.service.js";

// Service is exercised with a fake repository — no PostgreSQL.
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: {
    findByPhone: vi.fn(),
    listByRestaurant: vi.fn(),
    listAll: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    updateById: vi.fn(),
  },
}));

const repo = vi.mocked(guestRepository);

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

describe("guest.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findOrCreateGuest", () => {
    it("returns the existing guest untouched when nothing changed", async () => {
      const existing = makeGuest();
      repo.findByPhone.mockResolvedValue(existing);

      const result = await findOrCreateGuest({
        restaurantId: "r1",
        name: "Dana",
        phone: "+972500000000",
      } as Parameters<typeof findOrCreateGuest>[0]);

      expect(repo.findByPhone).toHaveBeenCalledWith("r1", "+972500000000");
      expect(repo.updateById).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it("updates the existing guest when an identifying field changed", async () => {
      const existing = makeGuest({ name: "Dana" });
      const updated = makeGuest({ name: "Dana Cohen" });
      repo.findByPhone.mockResolvedValue(existing);
      repo.updateById.mockResolvedValue(updated);

      const result = await findOrCreateGuest({
        restaurantId: "r1",
        name: "Dana Cohen",
        phone: "+972500000000",
      } as Parameters<typeof findOrCreateGuest>[0]);

      expect(repo.updateById).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ name: "Dana Cohen" }),
      );
      expect(result).toBe(updated);
    });

    it("inserts a new guest when none exists for the phone", async () => {
      const created = makeGuest({ id: "g2" });
      repo.findByPhone.mockResolvedValue(null);
      repo.insert.mockResolvedValue(created);

      const result = await findOrCreateGuest({
        restaurantId: "r1",
        name: "New Guest",
        phone: "+972511111111",
      } as Parameters<typeof findOrCreateGuest>[0]);

      expect(repo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "r1", phone: "+972511111111", language: "he" }),
      );
      expect(result).toBe(created);
    });
  });

  describe("listGuests", () => {
    it("scopes to a restaurant when restaurantId is provided", async () => {
      repo.listByRestaurant.mockResolvedValue([makeGuest()]);

      await listGuests({ restaurantId: "r1" });

      expect(repo.listByRestaurant).toHaveBeenCalledWith("r1");
      expect(repo.listAll).not.toHaveBeenCalled();
    });

    it("lists all guests (super-admin) when no restaurantId is provided", async () => {
      repo.listAll.mockResolvedValue([]);

      await listGuests({});

      expect(repo.listAll).toHaveBeenCalled();
      expect(repo.listByRestaurant).not.toHaveBeenCalled();
    });
  });

  describe("getGuestById", () => {
    it("maps a missing guest (null) to undefined", async () => {
      repo.findById.mockResolvedValue(null);
      expect(await getGuestById("nope")).toBeUndefined();
    });
  });

  describe("updateGuestPreferences", () => {
    it("returns the existing guest without writing when there is nothing to update", async () => {
      const existing = makeGuest();
      repo.findById.mockResolvedValue(existing);

      const result = await updateGuestPreferences("g1", {});

      expect(repo.updateById).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it("writes provided fields plus updatedAt through the repository", async () => {
      const updated = makeGuest({ notes: "VIP" });
      repo.updateById.mockResolvedValue(updated);

      const result = await updateGuestPreferences("g1", { notes: "VIP" });

      expect(repo.updateById).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ notes: "VIP", updatedAt: expect.any(Date) }),
      );
      expect(result).toBe(updated);
    });
  });
});
