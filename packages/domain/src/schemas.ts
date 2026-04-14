import { z } from "zod";

const hhmmStringSchema = z.string().regex(/^\d{2}:\d{2}$/);
const operatingHoursDayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const createReservationSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStart: hhmmStringSchema,
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
  timeStart: hhmmStringSchema,
  partySize: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional(),
  seatImmediately: z.boolean().default(false),
});

export const operatingHoursEntrySchema = z.object({
  open: hhmmStringSchema,
  close: hhmmStringSchema,
}).strict();

export const operatingHoursSchema = z
  .object({
    sun: operatingHoursEntrySchema.nullable().optional(),
    mon: operatingHoursEntrySchema.nullable().optional(),
    tue: operatingHoursEntrySchema.nullable().optional(),
    wed: operatingHoursEntrySchema.nullable().optional(),
    thu: operatingHoursEntrySchema.nullable().optional(),
    fri: operatingHoursEntrySchema.nullable().optional(),
    sat: operatingHoursEntrySchema.nullable().optional(),
  })
  .strict()
  .transform((hours) =>
    Object.fromEntries(
      operatingHoursDayKeys.map((dayKey) => [dayKey, hours[dayKey] ?? null]),
    ) as Record<(typeof operatingHoursDayKeys)[number], z.infer<typeof operatingHoursEntrySchema> | null>,
  );

export const selfServeSignupOwnerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
}).strict();

export const selfServeSignupTableBaseSchema = z.object({
  name: z.string().trim().min(1).max(50),
  minSeats: z.coerce.number().int().min(1).max(50),
  maxSeats: z.coerce.number().int().min(1).max(50),
  zone: optionalTrimmedString(50),
}).strict();

export const selfServeSignupTableSchema = selfServeSignupTableBaseSchema.superRefine((table, ctx) => {
  if (table.maxSeats < table.minSeats) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "maxSeats must be greater than or equal to minSeats",
      path: ["maxSeats"],
    });
  }
});

export const selfServeSignupTablesSchema = z.array(selfServeSignupTableSchema).min(1);

export const selfServeSignupRestaurantSchema = z.object({
  name: z.string().trim().min(1).max(255),
  cuisineType: optionalTrimmedString(100),
  phone: optionalTrimmedString(20),
  address: optionalTrimmedString(500),
  package: z.enum(["starter", "growth"]).default("starter"),
  locale: z.enum(["he", "en"]).default("he"),
  timezone: z.string().trim().min(1).max(50).default("Asia/Jerusalem"),
  operatingHours: operatingHoursSchema,
}).strict();

export const selfServeSignupSchema = z.object({
  owner: selfServeSignupOwnerSchema,
  restaurant: selfServeSignupRestaurantSchema,
  tables: selfServeSignupTablesSchema,
}).strict();

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
export type OperatingHoursInput = z.output<typeof operatingHoursSchema>;
export type SelfServeSignupOwnerInput = z.infer<typeof selfServeSignupOwnerSchema>;
export type SelfServeSignupRestaurantInput = z.output<typeof selfServeSignupRestaurantSchema>;
export type SelfServeSignupTableInput = z.infer<typeof selfServeSignupTableSchema>;
export type SelfServeSignupInput = z.output<typeof selfServeSignupSchema>;
