import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
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

function sendTableError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
  const logPayload = {
    ...context,
    code,
    requestId: request.id,
    statusCode,
    userId: request.user?.id,
    restaurantId: request.user?.restaurantId,
    role: request.user?.role,
  };

  if (statusCode >= 500) {
    request.log.error(logPayload, "Table request failed");
  } else {
    request.log.warn(logPayload, "Table request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

function sendCaughtTableError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Table operation failed";
  return sendTableError(request, reply, 500, message, code, {
    ...context,
    err: error,
  });
}

async function lookupTableRestaurantId(
  request: FastifyRequest,
  reply: FastifyReply,
  tableId: string,
): Promise<string | null | FastifyReply> {
  try {
    const [tableRow] = await db
      .select({ restaurantId: tables.restaurantId })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);
    return tableRow?.restaurantId ?? null;
  } catch (error: unknown) {
    return sendCaughtTableError(request, reply, error, "TABLE_LOOKUP_FAILED", { tableId });
  }
}

export async function tableRoutes(app: FastifyInstance) {
  // GET / — list tables for restaurant
  app.get("/", async (request, reply) => {
    const { restaurantId, includeInactive } = request.query as {
      restaurantId?: string;
      includeInactive?: string;
    };

    const roleErr = requireOperationalRole(request.user!);
    if (roleErr) {
      return sendTableError(request, reply, 403, roleErr, "TABLE_FORBIDDEN");
    }

    if (restaurantId) {
      const err = enforceTenant(request.user!, restaurantId);
      if (err) {
        return sendTableError(
          request,
          reply,
          403,
          err,
          "TABLE_FORBIDDEN",
          { restaurantLookupId: restaurantId },
        );
      }
    }

    const includeInactiveBool = includeInactive === "true";
    const scopedRestaurantId = resolveRestaurantId(request.user!, restaurantId);
    try {
      const tables = await listTables({
        restaurantId: scopedRestaurantId ?? undefined,
        includeInactive: includeInactiveBool,
      });

      return { tables };
    } catch (error: unknown) {
      return sendCaughtTableError(request, reply, error, "TABLE_LIST_FAILED", {
        restaurantLookupId: restaurantId,
        scopedRestaurantId,
        includeInactive,
      });
    }
  });

  // POST / — create table
  app.post("/", async (request, reply) => {
    const body = createTableSchema.parse(request.body);
    const err = enforceTenant(request.user!, body.restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendTableError(
        request,
        reply,
        403,
        err,
        "TABLE_FORBIDDEN",
        { restaurantLookupId: body.restaurantId },
      );
    }

    try {
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
    } catch (error: unknown) {
      return sendCaughtTableError(request, reply, error, "TABLE_CREATE_FAILED", {
        restaurantLookupId: body.restaurantId,
        minSeats: body.minSeats,
        maxSeats: body.maxSeats,
        zone: body.zone,
      });
    }
  });

  // PATCH /:id — update table
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTableSchema.parse(request.body ?? {}) as Parameters<typeof updateTable>[1];
    const restaurantId = await lookupTableRestaurantId(request, reply, id);
    if (typeof restaurantId !== "string" && restaurantId !== null) return restaurantId;

    if (!restaurantId) {
      return sendTableError(request, reply, 404, "Table not found", "TABLE_NOT_FOUND", { tableId: id });
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendTableError(
        request,
        reply,
        403,
        err,
        "TABLE_FORBIDDEN",
        { tableId: id, restaurantLookupId: restaurantId },
      );
    }

    try {
      const updated = await updateTable(id, body);
      if (!updated) {
        return sendTableError(request, reply, 404, "Table not found", "TABLE_NOT_FOUND", { tableId: id });
      }

      return { table: updated };
    } catch (error: unknown) {
      return sendCaughtTableError(request, reply, error, "TABLE_UPDATE_FAILED", {
        tableId: id,
        restaurantLookupId: restaurantId,
      });
    }
  });

  // DELETE /:id — deactivate table
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const restaurantId = await lookupTableRestaurantId(request, reply, id);
    if (typeof restaurantId !== "string" && restaurantId !== null) return restaurantId;

    if (!restaurantId) {
      return sendTableError(request, reply, 404, "Table not found", "TABLE_NOT_FOUND", { tableId: id });
    }

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendTableError(
        request,
        reply,
        403,
        err,
        "TABLE_FORBIDDEN",
        { tableId: id, restaurantLookupId: restaurantId },
      );
    }

    try {
      await deactivateTable(id);
      reply.code(204);
      return null;
    } catch (error: unknown) {
      return sendCaughtTableError(request, reply, error, "TABLE_DEACTIVATE_FAILED", {
        tableId: id,
        restaurantLookupId: restaurantId,
      });
    }
  });
}
