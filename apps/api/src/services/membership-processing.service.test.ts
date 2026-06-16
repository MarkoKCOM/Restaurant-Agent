import { beforeEach, describe, expect, it, vi } from "vitest";
import { membershipProcessingFailureRepository } from "../repositories/membership-processing-failure.repository.js";
import type { MembershipProcessingFailureRow } from "../repositories/membership-processing-failure.repository.js";
import {
  listMembershipProcessingFailures,
  retryMembershipProcessingFailure,
} from "./membership-processing.service.js";

vi.mock("../repositories/membership-processing-failure.repository.js", () => ({
  membershipProcessingFailureRepository: {
    insert: vi.fn(),
    list: vi.fn(),
    findByIdInRestaurant: vi.fn(),
    markResolved: vi.fn(),
    markRetryFailed: vi.fn(),
  },
}));

const repo = vi.mocked(membershipProcessingFailureRepository);

function makeFailure(overrides: Partial<MembershipProcessingFailureRow> = {}): MembershipProcessingFailureRow {
  return {
    id: "f1", restaurantId: "r1", guestId: "g1", reservationId: "res1", stage: "visit_auto_tags",
    status: "open", errorName: "Error", errorCode: null, errorMessage: "boom", attempts: 1,
    lastAttemptAt: new Date(), resolvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  } as MembershipProcessingFailureRow;
}

describe("membership-processing.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listMembershipProcessingFailures", () => {
    it("delegates to the repository", async () => {
      repo.list.mockResolvedValue([]);
      const params = { restaurantId: "r1", status: "open" as const, limit: 25 };

      await listMembershipProcessingFailures(params);

      expect(repo.list).toHaveBeenCalledWith(params);
    });
  });

  describe("retryMembershipProcessingFailure", () => {
    it("returns null when the failure is not found in the restaurant", async () => {
      repo.findByIdInRestaurant.mockResolvedValue(null);

      const result = await retryMembershipProcessingFailure({ failureId: "x", restaurantId: "r1" });

      expect(result).toBeNull();
      expect(repo.markResolved).not.toHaveBeenCalled();
    });

    it("returns an already-resolved failure without re-running the stage", async () => {
      const resolved = makeFailure({ status: "resolved" });
      repo.findByIdInRestaurant.mockResolvedValue(resolved);

      const result = await retryMembershipProcessingFailure({ failureId: "f1", restaurantId: "r1" });

      expect(result).toBe(resolved);
      expect(repo.markResolved).not.toHaveBeenCalled();
      expect(repo.markRetryFailed).not.toHaveBeenCalled();
    });
  });
});
