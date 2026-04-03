import { z } from "zod";

export const createReservationSchema = z.object({
  restaurantId: z.string().uuid(),
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional(),
  source: z.enum(["whatsapp", "web", "walk_in", "phone"]).default("web"),
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
  source: z.enum(["whatsapp", "web", "walk_in", "referral"]).default("web"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
