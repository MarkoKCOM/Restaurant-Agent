import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createTable,
  deactivateTable,
  listTables,
  updateTable,
} from "../services/table.service.js";

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  minSeats: z.coerce.number().int().min(1).default(1),
  maxSeats: z.coerce.number().int().min(1),
  zone: z.string().optional(),
  combinableWith: z.array(z.string().uuid()).optional(),
});

const updateTableSchema = createTableSchema
  .omit({ restaurantId: true })
  .extend({ isActive: z.boolean().optional() })
  .partial();

export async function tableRoutes(app: FastifyInstance) {
  // GET / — list tables for restaurant
  app.get("/", async (request) => {
    const { restaurantId, includeInactive } = request.query as {
      restaurantId?: string;
      includeInactive?: string;
    };

    const includeInactiveBool = includeInactive === "true";
    const tables = await listTables({
      restaurantId,
      includeInactive: includeInactiveBool,
    });

    return { tables };
  });

  // POST / — create table
  app.post("/", async (request, reply) => {
    const body = createTableSchema.parse(request.body);
    const table = await createTable({
      restaurantId: body.restaurantId,
      name: body.name,
      minSeats: body.minSeats,
      maxSeats: body.maxSeats,
      zone: body.zone,
      combinableWith: body.combinableWith,
    });
    reply.code(201);
    return { table };
  });

  // PATCH /:id — update table
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTableSchema.parse(request.body ?? {});

    const updated = await updateTable(id, body);
    if (!updated) {
      reply.code(404);
      return { error: "Table not found" };
    }

    return { table: updated };
  });

  // DELETE /:id — deactivate table
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    await deactivateTable(id);
    reply.code(204);
    return null;
  });
}
