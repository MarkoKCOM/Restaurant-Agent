import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { selfServeSignupTableBaseSchema, selfServeSignupTableSchema } from "@openseat/domain";
import {
  createTable,
  deactivateTable,
  listTables,
  updateTable,
} from "../services/table.service.js";
import { db } from "../db/index.js";
import { tables } from "../db/schema.js";
import { enforceTenant, requireOperationalRole, requireRestaurantAdmin, resolveRestaurantId } from "../middleware/auth.js";

const createTableSchema = selfServeSignupTableBaseSchema.extend({
  restaurantId: z.string().uuid(),
  combinableWith: z.array(z.string().uuid()).optional(),
}).superRefine((table, ctx) => {
  const result = selfServeSignupTableSchema.safeParse(table);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue(issue);
    }
  }
});

const updateTableSchema = selfServeSignupTableBaseSchema
  .extend({ isActive: z.boolean().optional() })
  .partial()
  .superRefine((table, ctx) => {
    const seatValidationTarget = {
      name: table.name ?? "temp",
      minSeats: table.minSeats ?? 1,
      maxSeats: table.maxSeats ?? table.minSeats ?? 1,
      zone: table.zone,
    };
    const result = selfServeSignupTableSchema.safeParse(seatValidationTarget);
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === "maxSeats" || issue.path[0] === "minSeats") {
          ctx.addIssue(issue);
        }
      }
    }
  });

export async function tableRoutes(app: FastifyInstance) {
  // GET / — list tables for restaurant
  app.get("/", async (request, reply) => {
    const { restaurantId, includeInactive } = request.query as {
      restaurantId?: string;
      includeInactive?: string;
    };

    const roleErr = requireOperationalRole(request.user!);
    if (roleErr) {
      return reply.status(403).send({ error: roleErr });
    }

    if (restaurantId) {
      const err = enforceTenant(request.user!, restaurantId);
      if (err) {
        return reply.status(403).send({ error: err });
      }
    }

    const includeInactiveBool = includeInactive === "true";
    const scopedRestaurantId = resolveRestaurantId(request.user!, restaurantId);
    const tables = await listTables({
      restaurantId: scopedRestaurantId ?? undefined,
      includeInactive: includeInactiveBool,
    });

    return { tables };
  });

  // POST / — create table
  app.post("/", async (request, reply) => {
    const body = createTableSchema.parse(request.body);
    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

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
    const body = updateTableSchema.parse(request.body ?? {}) as Parameters<typeof updateTable>[1];
    const [tableRow] = await db
      .select({ restaurantId: tables.restaurantId })
      .from(tables)
      .where(eq(tables.id, id))
      .limit(1);

    if (!tableRow) {
      reply.code(404);
      return { error: "Table not found" };
    }

    const err = enforceTenant(request.user!, tableRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

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
    const [tableRow] = await db
      .select({ restaurantId: tables.restaurantId })
      .from(tables)
      .where(eq(tables.id, id))
      .limit(1);

    if (!tableRow) {
      reply.code(404);
      return { error: "Table not found" };
    }

    const err = enforceTenant(request.user!, tableRow.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    await deactivateTable(id);
    reply.code(204);
    return null;
  });
}
