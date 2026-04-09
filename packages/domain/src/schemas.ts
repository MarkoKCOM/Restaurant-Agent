import { z } from "zod";

export const createReservationSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional(),
  source: z.enum(["whatsapp", "web", "walk_in", "phone", "telegram"]).default("web"),
});

export const availabilityQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
});

export const createGuestSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  language: z.enum(["he", "en", "ar", "ru"]).default("he"),
  source: z.enum(["whatsapp", "web", "walk_in", "referral", "telegram"]).default("web"),
});

export const createWalkInSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional(),
  seatImmediately: z.boolean().default(false),
});

// ── Dashboard config validation ────────────────────────────────────────────

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional();

export const dashboardPaletteSchema = z.object({
  primary: hexColor,
  sidebar: hexColor,
  sidebarText: hexColor,
  surface: hexColor,
  accent: hexColor,
}).strict();

export const dashboardBrandingSchema = z.object({
  logo: z.string().url().optional(),
  wordmark: z.string().url().optional(),
  tagline: z.string().max(120).optional(),
}).strict();

export const dashboardConfigSchema = z.object({
  // Legacy fields (kept for compatibility)
  accentColor: hexColor,
  logo: z.string().url().optional(),
  // Structured brand kit
  palette: dashboardPaletteSchema.optional(),
  branding: dashboardBrandingSchema.optional(),
  language: z.enum(["he", "en"]).optional(),
  visiblePages: z.array(z.string()).optional(),
  features: z.object({
    waitlist: z.boolean().optional(),
    loyalty: z.boolean().optional(),
    guestNotes: z.boolean().optional(),
    occupancyHeatmap: z.boolean().optional(),
    tableMap: z.boolean().optional(),
  }).optional(),
}).passthrough();

export type DashboardConfigInput = z.infer<typeof dashboardConfigSchema>;

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateGuestInput = z.input<typeof createGuestSchema>;
export type CreateWalkInInput = z.infer<typeof createWalkInSchema>;
