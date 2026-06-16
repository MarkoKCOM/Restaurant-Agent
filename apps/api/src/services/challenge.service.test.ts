import { beforeEach, describe, expect, it, vi } from "vitest";
import { challengeRepository } from "../repositories/challenge.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { awardPoints } from "./loyalty.service.js";
import { scheduleChallengeCompletion } from "./engagement.service.js";
import {
  incrementChallengeProgress,
  updateChallenge,
} from "./challenge.service.js";

vi.mock("../repositories/challenge.repository.js", () => ({
  challengeRepository: {
    insert: vi.fn(),
    findById: vi.fn(),
    findByIdInRestaurant: vi.fn(),
    updateInRestaurant: vi.fn(),
    listActive: vi.fn(),
    listActiveByTypes: vi.fn(),
    findBirthdayWeek: vi.fn(),
    findByRestaurant: vi.fn(),
    findProgressByGuest: vi.fn(),
    findProgress: vi.fn(),
    insertProgress: vi.fn(),
    updateProgressById: vi.fn(),
  },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), updateById: vi.fn(), listByRestaurant: vi.fn() },
}));
vi.mock("../repositories/loyalty-transaction.repository.js", () => ({
  loyaltyTransactionRepository: { findEarnByReason: vi.fn(), findEarnByReasonForGuest: vi.fn() },
}));
vi.mock("./loyalty.service.js", () => ({ awardPoints: vi.fn() }));
vi.mock("./engagement.service.js", () => ({
  scheduleChallengeCompletion: vi.fn(),
  scheduleStreakBrokenRecovery: vi.fn(),
}));

const challengeRepo = vi.mocked(challengeRepository);
const guestRepo = vi.mocked(guestRepository);
const awardPointsMock = vi.mocked(awardPoints);
const scheduleCompletionMock = vi.mocked(scheduleChallengeCompletion);

describe("challenge.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateChallenge", () => {
    it("returns null when the challenge is not in the restaurant", async () => {
      challengeRepo.findByIdInRestaurant.mockResolvedValue(null);

      expect(await updateChallenge("c1", "r1", { name: "x" })).toBeNull();
      expect(challengeRepo.updateInRestaurant).not.toHaveBeenCalled();
    });
  });

  describe("incrementChallengeProgress", () => {
    it("throws when the challenge does not exist", async () => {
      challengeRepo.findById.mockResolvedValue(null);
      await expect(incrementChallengeProgress("g1", "c1")).rejects.toThrow(/Challenge not found/);
    });

    it("increments without completing when below target", async () => {
      challengeRepo.findById.mockResolvedValue({
        id: "c1", targetValue: 3, rewardPoints: 50, name: "Visit 3x",
      } as never);
      challengeRepo.findProgress.mockResolvedValue({
        id: "p1", currentValue: 0, completedAt: null,
      } as never);
      challengeRepo.updateProgressById.mockResolvedValue({} as never);

      const result = await incrementChallengeProgress("g1", "c1");

      expect(result.completed).toBe(false);
      expect(result.progress).toBe(1);
      expect(awardPointsMock).not.toHaveBeenCalled();
    });

    it("completes at target and awards the reward points", async () => {
      challengeRepo.findById.mockResolvedValue({
        id: "c1", targetValue: 3, rewardPoints: 50, name: "Visit 3x",
      } as never);
      challengeRepo.findProgress.mockResolvedValue({
        id: "p1", currentValue: 2, completedAt: null,
      } as never);
      challengeRepo.updateProgressById.mockResolvedValue({} as never);
      guestRepo.findById.mockResolvedValue({ id: "g1", restaurantId: "r1" } as never);
      scheduleCompletionMock.mockResolvedValue({ id: "job1" } as never);

      const result = await incrementChallengeProgress("g1", "c1");

      expect(result.completed).toBe(true);
      expect(awardPointsMock).toHaveBeenCalledWith(
        "g1", "r1", 50, "challenge_completed:Visit 3x",
      );
      expect(result.completionJobId).toBe("job1");
    });

    it("is idempotent once the progress row is already completed", async () => {
      challengeRepo.findById.mockResolvedValue({
        id: "c1", targetValue: 3, rewardPoints: 50, name: "Visit 3x",
      } as never);
      challengeRepo.findProgress.mockResolvedValue({
        id: "p1", currentValue: 3, completedAt: new Date(),
      } as never);

      const result = await incrementChallengeProgress("g1", "c1");

      expect(result.completed).toBe(true);
      expect(challengeRepo.updateProgressById).not.toHaveBeenCalled();
      expect(awardPointsMock).not.toHaveBeenCalled();
    });
  });
});
