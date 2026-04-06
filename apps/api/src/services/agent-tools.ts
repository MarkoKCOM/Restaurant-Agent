/**
 * Agent tool definitions — wired to existing OpenSeat services.
 * Each tool has a name, description, JSON schema params, and an executor.
 */

import { checkAvailability, createReservation, cancelReservation } from "./reservation.service.js";
import { findOrCreateGuest, toDomainGuest } from "./guest.service.js";
import { addToWaitlist } from "./waitlist.service.js";
import { db } from "../db/index.js";
import { guests, restaurants } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

interface ConversationContext {
  restaurantId: string;
  guestPhone?: string;
  guestName?: string;
  language: string;
}

// ── Tool Definitions ────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const agentTools: ToolDef[] = [
  {
    name: "check_availability",
    description: "Check available time slots for a given date and party size",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        partySize: { type: "number", description: "Number of guests" },
      },
      required: ["date", "partySize"],
    },
  },
  {
    name: "create_reservation",
    description: "Create a new reservation for a guest. Confirm details with the guest before calling this.",
    parameters: {
      type: "object",
      properties: {
        guestName: { type: "string", description: "Guest's full name" },
        guestPhone: { type: "string", description: "Guest's phone number" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        timeStart: { type: "string", description: "Start time in HH:MM format" },
        partySize: { type: "number", description: "Number of guests" },
        notes: { type: "string", description: "Special requests or notes" },
      },
      required: ["guestName", "guestPhone", "date", "timeStart", "partySize"],
    },
  },
  {
    name: "cancel_reservation",
    description: "Cancel an existing reservation by its ID",
    parameters: {
      type: "object",
      properties: {
        reservationId: { type: "string", description: "The reservation UUID" },
      },
      required: ["reservationId"],
    },
  },
  {
    name: "add_to_waitlist",
    description: "Add a guest to the waitlist when no slots are available",
    parameters: {
      type: "object",
      properties: {
        guestName: { type: "string", description: "Guest's full name" },
        guestPhone: { type: "string", description: "Guest's phone number" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        preferredTimeStart: { type: "string", description: "Preferred start time HH:MM" },
        preferredTimeEnd: { type: "string", description: "Preferred end time HH:MM" },
        partySize: { type: "number", description: "Number of guests" },
      },
      required: ["guestName", "guestPhone", "date", "preferredTimeStart", "preferredTimeEnd", "partySize"],
    },
  },
  {
    name: "get_restaurant_info",
    description: "Get restaurant details including operating hours, address, and phone",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_guest_profile",
    description: "Look up a guest's profile by phone number to see their history and preferences",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Guest phone number" },
      },
      required: ["phone"],
    },
  },
];

// ── Tool Executors ──────────────────────────────────

type ToolExecutor = (args: Record<string, unknown>, ctx: ConversationContext) => Promise<unknown>;

const executors: Record<string, ToolExecutor> = {
  async check_availability(args, ctx) {
    const { date, partySize } = args as { date: string; partySize: number };
    const slots = await checkAvailability({ restaurantId: ctx.restaurantId, date, partySize });
    if (!slots.length) {
      return { available: false, message: "No slots available for this date and party size." };
    }
    return {
      available: true,
      date,
      partySize,
      slots: slots.slice(0, 8).map((s) => ({
        time: s.time,
        availableTables: s.availableTables,
      })),
    };
  },

  async create_reservation(args, ctx) {
    const { guestName, guestPhone, date, timeStart, partySize, notes } = args as {
      guestName: string; guestPhone: string; date: string; timeStart: string; partySize: number; notes?: string;
    };

    const reservation = await createReservation({
      restaurantId: ctx.restaurantId,
      guestName,
      guestPhone,
      date,
      timeStart,
      partySize,
      notes,
      source: "whatsapp",
    });

    return {
      success: true,
      reservationId: reservation.id,
      status: reservation.status,
      date: reservation.date,
      time: reservation.timeStart,
      partySize: reservation.partySize,
    };
  },

  async cancel_reservation(args) {
    const { reservationId } = args as { reservationId: string };
    const result = await cancelReservation(reservationId);
    return { success: true, cancelled: result };
  },

  async add_to_waitlist(args, ctx) {
    const { guestName, guestPhone, date, preferredTimeStart, preferredTimeEnd, partySize } = args as {
      guestName: string; guestPhone: string; date: string;
      preferredTimeStart: string; preferredTimeEnd: string; partySize: number;
    };

    const entry = await addToWaitlist({
      restaurantId: ctx.restaurantId,
      guestName,
      guestPhone,
      date,
      preferredTimeStart,
      preferredTimeEnd,
      partySize,
    });

    return {
      success: true,
      waitlistId: entry.id,
      status: entry.status,
    };
  },

  async get_restaurant_info(_args, ctx) {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, ctx.restaurantId))
      .limit(1);

    if (!restaurant) return { error: "Restaurant not found" };

    return {
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      website: restaurant.website,
      cuisineType: restaurant.cuisineType,
      operatingHours: restaurant.operatingHours,
    };
  },

  async get_guest_profile(args, ctx) {
    const { phone } = args as { phone: string };
    const [existing] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.restaurantId, ctx.restaurantId), eq(guests.phone, phone)))
      .limit(1);

    if (existing) return toDomainGuest(existing);

    return { found: false, phone };
  },
};

// ── Execute Tool ────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ConversationContext,
): Promise<unknown> {
  const executor = executors[name];
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return executor(args, ctx);
}
