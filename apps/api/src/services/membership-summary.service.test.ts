import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestRepository } from "../repositories/guest.repository.js";
import { getMembershipSummary } from "./membership-summary.service.js";

vi.mock("../repositories/guest.repository.js", () => ({
  guestRepository: { findById: vi.fn() },
}));

const guestRepo = vi.mocked(guestRepository);

describe("membership-summary.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the guest does not exist", async () => {
    guestRepo.findById.mockResolvedValue(null);

    const result = await getMembershipSummary("missing");

    expect(guestRepo.findById).toHaveBeenCalledWith("missing");
    expect(result).toBeNull();
  });
});
