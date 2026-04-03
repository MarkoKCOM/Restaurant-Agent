import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  minSeats: z.coerce.number().int().min(1).default(1),
  maxSeats: z.coerce.number().int().min(1),
  zone: z.string().optional(),
  combinableWith: z.array(z.string().uuid()).optional(),
});

export async function tableRoutes(app: FastifyInstance) {
  // GET / — list tables for restaurant
  app.get("/", async (request) => {
    const { restaurantId } = request.query as { restaurantId?: string };
    // TODO: query tables
    return { tables: [], filters: { restaurantId } };
  });

  // POST / — create table
  app.post("/", async (request) => {
    const body = createTableSchema.parse(request.body);
    // TODO: create table
    return { message: "table created", body };
  });

  // PATCH /:id — update table
  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: update table
    return { message: "table updated", id };
  });

  // DELETE /:id — deactivate table
  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: set is_active = false
    return { message: "table deactivated", id };
  });
}
