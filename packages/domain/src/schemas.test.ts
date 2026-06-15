import { describe, it, expect } from "vitest";

import {
  availabilityQuerySchema,
  createGuestSchema,
  createReservationSchema,
} from "./schemas.js";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("createReservationSchema", () => {
  const base = {
    restaurantId: UUID,
    guestName: "Dana",
    guestPhone: "0501234567",
    date: "2026-06-20",
    timeStart: "19:30",
    partySize: 4,
  };

  it("accepts a valid reservation and defaults source to web", () => {
    const parsed = createReservationSchema.parse(base);
    expect(parsed.source).toBe("web");
    expect(parsed.partySize).toBe(4);
  });

  it("coerces a numeric-string partySize", () => {
    const parsed = createReservationSchema.parse({ ...base, partySize: "2" });
    expect(parsed.partySize).toBe(2);
  });

  it("rejects a non-uuid restaurantId", () => {
    expect(createReservationSchema.safeParse({ ...base, restaurantId: "nope" }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(createReservationSchema.safeParse({ ...base, date: "20/06/2026" }).success).toBe(false);
  });

  it("rejects a malformed time", () => {
    expect(createReservationSchema.safeParse({ ...base, timeStart: "7pm" }).success).toBe(false);
  });

  it("rejects a party size below 1 and above 50", () => {
    expect(createReservationSchema.safeParse({ ...base, partySize: 0 }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...base, partySize: 51 }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(createReservationSchema.safeParse({ ...base, source: "carrier-pigeon" }).success).toBe(false);
  });
});

describe("availabilityQuerySchema", () => {
  it("coerces partySize from a query-string value", () => {
    const parsed = availabilityQuerySchema.parse({ restaurantId: UUID, date: "2026-06-20", partySize: "3" });
    expect(parsed.partySize).toBe(3);
  });

  it("rejects a missing date", () => {
    expect(availabilityQuerySchema.safeParse({ restaurantId: UUID, partySize: 2 }).success).toBe(false);
  });
});

describe("createGuestSchema", () => {
  it("defaults language to he and source to web", () => {
    const parsed = createGuestSchema.parse({ restaurantId: UUID, name: "Avi", phone: "0501112222" });
    expect(parsed.language).toBe("he");
    expect(parsed.source).toBe("web");
  });

  it("rejects an invalid email", () => {
    expect(
      createGuestSchema.safeParse({ restaurantId: UUID, name: "Avi", phone: "0501112222", email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});
