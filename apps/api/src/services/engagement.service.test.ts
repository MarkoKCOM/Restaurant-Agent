import { beforeEach, describe, expect, it, vi } from "vitest";
import { engagementJobRepository } from "../repositories/engagement-job.repository.js";
import { restaurantRepository } from "../repositories/restaurant.repository.js";
import { visitRepository } from "../repositories/visit.repository.js";
import {
  getEngagementMessageCategory,
  getRestaurantEngagementQuietHours,
  listEngagementJobs,
  scheduleReviewRequest,
} from "./engagement.service.js";

vi.mock("../repositories/engagement-job.repository.js", () => ({
  engagementJobRepository: {
    insert: vi.fn(),
    findPending: vi.fn(),
    findAny: vi.fn(),
    findInWindow: vi.fn(),
    countPromotionalInWindow: vi.fn(),
    skipPending: vi.fn(),
    updateById: vi.fn(),
    list: vi.fn(),
  },
}));
vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn(), listByRestaurant: vi.fn(), listLapsedInWindow: vi.fn() },
}));
vi.mock("../repositories/restaurant.repository.js", () => ({
  restaurantRepository: { findById: vi.fn() },
}));
vi.mock("../repositories/visit.repository.js", () => ({
  visitRepository: { findPositiveForReservation: vi.fn() },
}));
vi.mock("../queue/index.js", () => ({
  engagementQueue: { add: vi.fn() },
}));

const jobRepo = vi.mocked(engagementJobRepository);
const restaurantRepo = vi.mocked(restaurantRepository);
const visitRepo = vi.mocked(visitRepository);

describe("engagement.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies promotional vs transactional message categories", () => {
    expect(getEngagementMessageCategory("birthday")).toBe("promotional");
    expect(getEngagementMessageCategory("thank_you")).toBe("transactional");
  });

  describe("listEngagementJobs", () => {
    it("delegates straight to the repository", async () => {
      jobRepo.list.mockResolvedValue([]);
      const params = { restaurantId: "r1", status: "pending", limit: 10 };

      await listEngagementJobs(params);

      expect(jobRepo.list).toHaveBeenCalledWith(params);
    });
  });

  describe("getRestaurantEngagementQuietHours", () => {
    it("falls back to default timezone and quiet hours when unset", async () => {
      restaurantRepo.findById.mockResolvedValue({ timezone: null, dashboardConfig: null } as never);

      const result = await getRestaurantEngagementQuietHours("r1");

      expect(restaurantRepo.findById).toHaveBeenCalledWith("r1");
      expect(result.timeZone).toBe("Asia/Jerusalem");
      expect(result.quietHours.enabled).toBe(true);
    });
  });

  describe("scheduleReviewRequest", () => {
    it("returns null (schedules nothing) without a positive-feedback visit", async () => {
      visitRepo.findPositiveForReservation.mockResolvedValue(null);

      const result = await scheduleReviewRequest("g1", "r1", "res1");

      expect(visitRepo.findPositiveForReservation).toHaveBeenCalledWith("g1", "r1", "res1");
      expect(result).toBeNull();
      expect(jobRepo.insert).not.toHaveBeenCalled();
    });
  });
});
