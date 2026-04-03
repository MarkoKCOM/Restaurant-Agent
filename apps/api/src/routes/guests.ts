import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createGuestSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  language: z.enum(["he", "en", "ar", "ru"]).default("he"),
  source: z.enum(["whatsapp", "web", "walk_in", "referral"]).default("web"),
});

export async function guestRoutes(app: FastifyInstance) {
  // GET / — list guests
  app.get("/", async (request) => {
    const { restaurantId } = request.query as { restaurantId?: string };
    // TODO: query guests with filters
    return { guests: [], filters: { restaurantId } };
  });

  // GET /:id — guest profile
  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: fetch guest with visit history
    return { guest: null, id };
  });

  // POST / — create guest
  app.post("/", async (request) => {
    const body = createGuestSchema.parse(request.body);
    // TODO: create guest, check for duplicates by phone
    return { message: "guest created", body };
  });

  // PATCH /:id — update guest
  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: update guest preferences, notes, tags
    return { message: "guest updated", id };
  });
}
