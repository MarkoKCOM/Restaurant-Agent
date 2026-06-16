import { beforeEach, describe, expect, it, vi } from "vitest";
import { tableRepository } from "../repositories/table.repository.js";
import type { TableRow } from "../repositories/table.repository.js";
import {
  deactivateTable,
  listTables,
  pickBestTablesForParty,
  updateTable,
} from "./table.service.js";

// The whole point of the seam: the service is testable with a fake repository,
// no PostgreSQL connection required.
vi.mock("../repositories/table.repository.js", () => ({
  tableRepository: {
    findActiveByRestaurant: vi.fn(),
    findByRestaurant: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findRestaurantIdById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const repo = vi.mocked(tableRepository);

function makeTable(overrides: Partial<TableRow> = {}): TableRow {
  return {
    id: "t1",
    restaurantId: "r1",
    name: "T1",
    minSeats: 1,
    maxSeats: 2,
    zone: null,
    combinableWith: null,
    isActive: true,
    ...overrides,
  };
}

describe("table.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listTables", () => {
    it("scopes to the restaurant when restaurantId is provided", async () => {
      repo.findByRestaurant.mockResolvedValue([makeTable()]);

      const result = await listTables({ restaurantId: "r1", includeInactive: true });

      expect(repo.findByRestaurant).toHaveBeenCalledWith("r1", { includeInactive: true });
      expect(repo.findAll).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("falls back to the unscoped listing when no restaurantId is provided", async () => {
      repo.findAll.mockResolvedValue([]);

      await listTables({ includeInactive: false });

      expect(repo.findAll).toHaveBeenCalledWith({ includeInactive: false });
      expect(repo.findByRestaurant).not.toHaveBeenCalled();
    });
  });

  describe("updateTable", () => {
    it("returns the existing row via tenant-scoped findById when there are no updates", async () => {
      const existing = makeTable();
      repo.findById.mockResolvedValue(existing);

      const result = await updateTable("t1", "r1", {});

      expect(repo.findById).toHaveBeenCalledWith("t1", "r1");
      expect(repo.update).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it("applies updates through the tenant-scoped repository update", async () => {
      const updated = makeTable({ name: "Renamed" });
      repo.update.mockResolvedValue(updated);

      const result = await updateTable("t1", "r1", { name: "Renamed" });

      expect(repo.update).toHaveBeenCalledWith("t1", "r1", { name: "Renamed" });
      expect(result).toBe(updated);
    });
  });

  describe("deactivateTable", () => {
    it("deactivates through the tenant-scoped repository", async () => {
      repo.deactivate.mockResolvedValue(undefined);

      await deactivateTable("t1", "r1");

      expect(repo.deactivate).toHaveBeenCalledWith("t1", "r1");
    });
  });

  // Pure business logic — no repository involved.
  describe("pickBestTablesForParty", () => {
    it("returns null when there are no tables", () => {
      expect(pickBestTablesForParty([], 2)).toBeNull();
    });

    it("prefers the smallest single table that fits the party", () => {
      const tables = [
        makeTable({ id: "small", minSeats: 1, maxSeats: 2 }),
        makeTable({ id: "big", minSeats: 1, maxSeats: 6 }),
      ];

      expect(pickBestTablesForParty(tables, 2)).toEqual(["small"]);
    });

    it("combines two tables when no single table fits", () => {
      const tables = [
        makeTable({ id: "a", minSeats: 1, maxSeats: 2 }),
        makeTable({ id: "b", minSeats: 1, maxSeats: 2 }),
      ];

      expect(pickBestTablesForParty(tables, 4)).toEqual(["a", "b"]);
    });
  });
});
