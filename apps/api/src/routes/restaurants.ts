import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { restaurants, reservations, tables, guests as guestsTable } from "../db/schema.js";
import { getDailySummary } from "../services/summary.service.js";
import { enforceTenant, requireOperationalRole, requireRestaurantAdmin } from "../middleware/auth.js";
import { dashboardConfigSchema } from "@openseat/domain";

/**
 * Normalize stored dashboardConfig: promotes legacy accentColor/logo into
 * the structured palette/branding fields while keeping both for compatibility.
 */
function normalizeDashboardConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const cfg = raw as Record<string, unknown>;

  // Promote legacy accentColor → palette.primary (if palette.primary not set)
  const palette = (cfg.palette as Record<string, unknown> | undefined) ?? {};
  if (cfg.accentColor && !palette.primary) {
    palette.primary = cfg.accentColor;
  }

  // Promote legacy logo → branding.logo (if branding.logo not set)
  const branding = (cfg.branding as Record<string, unknown> | undefined) ?? {};
  if (cfg.logo && !branding.logo) {
    branding.logo = cfg.logo;
  }

  return {
    ...cfg,
    palette: Object.keys(palette).length > 0 ? palette : undefined,
    branding: Object.keys(branding).length > 0 ? branding : undefined,
  };
}

function sendRestaurantError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
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
    request.log.error(logPayload, "Restaurant request failed");
  } else {
    request.log.warn(logPayload, "Restaurant request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
    ...extra,
  });
}

function sendCaughtRestaurantError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Restaurant operation failed";
  return sendRestaurantError(request, reply, 500, message, code, {
    ...context,
    err: error,
  });
}

export async function restaurantRoutes(app: FastifyInstance) {
  // GET / — list all restaurants
  app.get("/", async (request, reply) => {
    try {
      const rows = await db.select().from(restaurants);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        cuisineType: r.cuisineType,
        address: r.address,
        phone: r.phone,
        email: r.email,
        timezone: r.timezone,
        locale: r.locale,
        operatingHours: r.operatingHours,
        package: r.package,
        widgetConfig: r.widgetConfig,
      }));
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_LIST_FAILED");
    }
  });

  // GET /:id — restaurant details
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    let row: typeof restaurants.$inferSelect | undefined;
    try {
      [row] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, id))
        .limit(1);
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_LOOKUP_FAILED", {
        restaurantLookupId: id,
      });
    }

    if (!row) {
      return sendRestaurantError(
        request,
        reply,
        404,
        "Restaurant not found",
        "RESTAURANT_NOT_FOUND",
        { restaurantLookupId: id },
      );
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      cuisineType: row.cuisineType,
      address: row.address,
      phone: row.phone,
      email: row.email,
      timezone: row.timezone,
      locale: row.locale,
      operatingHours: row.operatingHours,
      package: row.package,
      widgetConfig: row.widgetConfig,
      dashboardConfig: normalizeDashboardConfig(row.dashboardConfig),
    };
  });

  // PATCH /:id — update restaurant settings
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const err = enforceTenant(request.user!, id) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    const updates: Record<string, unknown> = {};
    const allowed = [
      "name",
      "phone",
      "email",
      "address",
      "description",
      "timezone",
      "locale",
      "whatsappNumber",
      "ownerPhone",
      "ownerWhatsapp",
      "operatingHours",
      "widgetConfig",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Validate and normalize dashboardConfig if provided.
    if (body.dashboardConfig !== undefined) {
      const parsed = dashboardConfigSchema.safeParse(body.dashboardConfig);
      if (!parsed.success) {
        return sendRestaurantError(
          request,
          reply,
          400,
          "Invalid dashboardConfig",
          "RESTAURANT_INVALID_DASHBOARD_CONFIG",
          { restaurantLookupId: id },
          { details: parsed.error.flatten() },
        );
      }
      updates.dashboardConfig = normalizeDashboardConfig(parsed.data);
    }

    if (Object.keys(updates).length === 0) {
      return sendRestaurantError(
        request,
        reply,
        400,
        "No valid fields to update",
        "RESTAURANT_NO_VALID_FIELDS",
        { restaurantLookupId: id },
      );
    }

    updates.updatedAt = new Date();

    let updated: typeof restaurants.$inferSelect | undefined;
    try {
      [updated] = await db
        .update(restaurants)
        .set(updates)
        .where(eq(restaurants.id, id))
        .returning();
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_UPDATE_FAILED", {
        restaurantLookupId: id,
        updateFields: Object.keys(updates).filter((key) => key !== "updatedAt"),
      });
    }

    if (!updated) {
      return sendRestaurantError(
        request,
        reply,
        404,
        "Restaurant not found",
        "RESTAURANT_NOT_FOUND",
        { restaurantLookupId: id },
      );
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      address: updated.address,
      phone: updated.phone,
      email: updated.email,
      timezone: updated.timezone,
      locale: updated.locale,
      whatsappNumber: updated.whatsappNumber,
      ownerPhone: updated.ownerPhone,
      ownerWhatsapp: updated.ownerWhatsapp,
      operatingHours: updated.operatingHours,
      widgetConfig: updated.widgetConfig,
      dashboardConfig: normalizeDashboardConfig(updated.dashboardConfig),
    };
  });

  // GET /:id/dashboard — dashboard snapshot for today
  app.get("/:id/dashboard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const err = enforceTenant(request.user!, id);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    let restaurant: typeof restaurants.$inferSelect | undefined;
    try {
      [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, id))
        .limit(1);
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_DASHBOARD_FAILED", {
        restaurantLookupId: id,
        stage: "restaurant_lookup",
      });
    }

    if (!restaurant) {
      return sendRestaurantError(
        request,
        reply,
        404,
        "Restaurant not found",
        "RESTAURANT_NOT_FOUND",
        { restaurantLookupId: id },
      );
    }

    let todayReservations: Array<typeof reservations.$inferSelect>;
    try {
      todayReservations = await db
        .select()
        .from(reservations)
        .where(
          and(eq(reservations.restaurantId, id), eq(reservations.date, today)),
        )
        .orderBy(reservations.timeStart);
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_DASHBOARD_FAILED", {
        restaurantLookupId: id,
        date: today,
        stage: "reservations_lookup",
      });
    }

    const activeStatuses = ["pending", "confirmed", "seated", "completed"];
    const active = todayReservations.filter((r) =>
      activeStatuses.includes(r.status),
    );

    const totalReservations = active.length;
    const totalCovers = active.reduce((sum, r) => sum + r.partySize, 0);
    const cancellations = todayReservations.filter(
      (r) => r.status === "cancelled",
    ).length;
    const noShows = todayReservations.filter(
      (r) => r.status === "no_show",
    ).length;

    // Build occupancyByHour from operating hours and today's reservations
    const operatingHours = (restaurant.operatingHours as unknown as Record<
      string,
      { open: string; close: string } | null
    >) ?? {};
    const todayDate = new Date(`${today}T12:00:00`);
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const dayKey = dayNames[todayDate.getDay()];
    const dayHours = operatingHours[dayKey];

    const occupancyByHour: Record<string, number> = {};

    if (dayHours) {
      const [openH, openM] = dayHours.open.split(":").map(Number);
      const [closeH, closeM] = dayHours.close.split(":").map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      // Generate 30-minute slots
      for (let t = openMinutes; t < closeMinutes; t += 30) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const slotKey = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        occupancyByHour[slotKey] = 0;
      }

      // Count covers per slot based on reservation overlap
      const activeToday = todayReservations.filter((r) =>
        ["pending", "confirmed", "seated", "completed"].includes(r.status),
      );

      for (const res of activeToday) {
        const [rStartH, rStartM] = res.timeStart.split(":").map(Number);
        const resStart = rStartH * 60 + rStartM;
        const resEndStr = res.timeEnd ?? null;
        let resEnd: number;
        if (resEndStr) {
          const [rEndH, rEndM] = resEndStr.split(":").map(Number);
          resEnd = rEndH * 60 + rEndM;
        } else {
          resEnd = resStart + 120; // default 2 hours
        }

        for (let t = openMinutes; t < closeMinutes; t += 30) {
          const slotEnd = t + 30;
          // Check if reservation overlaps with this slot
          if (resStart < slotEnd && resEnd > t) {
            const h = Math.floor(t / 60);
            const m = t % 60;
            const slotKey = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            occupancyByHour[slotKey] = (occupancyByHour[slotKey] ?? 0) + res.partySize;
          }
        }
      }
    }

    return {
      today: {
        reservations: totalReservations,
        covers: totalCovers,
        cancellations,
        noShows,
      },
      occupancyByHour,
      reservationIds: todayReservations.map((r) => r.id),
    };
  });

  // GET /:id/summary — daily summary for restaurant owner
  app.get("/:id/summary", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { date } = request.query as { date?: string };
    const err = enforceTenant(request.user!, id) ?? requireOperationalRole(request.user!);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    let restaurant: typeof restaurants.$inferSelect | undefined;
    try {
      [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, id))
        .limit(1);
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_SUMMARY_FAILED", {
        restaurantLookupId: id,
        stage: "restaurant_lookup",
      });
    }

    if (!restaurant) {
      return sendRestaurantError(
        request,
        reply,
        404,
        "Restaurant not found",
        "RESTAURANT_NOT_FOUND",
        { restaurantLookupId: id },
      );
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);
    try {
      const summary = await getDailySummary(id, targetDate);
      return summary;
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_SUMMARY_FAILED", {
        restaurantLookupId: id,
        date: targetDate,
        stage: "summary_build",
      });
    }
  });

  // GET /:id/table-status — live table status for today
  app.get("/:id/table-status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const err = enforceTenant(request.user!, id);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM

    let allTables: Array<typeof tables.$inferSelect>;
    let todayReservations: Array<{
      id: string;
      guestId: string;
      date: string;
      timeStart: string;
      timeEnd: string | null;
      partySize: number;
      tableIds: unknown;
      status: string;
    }>;
    let guestRows: Array<{ id: string; name: string }>;
    try {
      // Get all active tables
      allTables = await db
        .select()
        .from(tables)
        .where(and(eq(tables.restaurantId, id), eq(tables.isActive, true)));

      // Get today's reservations that aren't cancelled/no_show/completed
      todayReservations = await db
        .select({
          id: reservations.id,
          guestId: reservations.guestId,
          date: reservations.date,
          timeStart: reservations.timeStart,
          timeEnd: reservations.timeEnd,
          partySize: reservations.partySize,
          tableIds: reservations.tableIds,
          status: reservations.status,
        })
        .from(reservations)
        .where(
          and(
            eq(reservations.restaurantId, id),
            eq(reservations.date, today),
          ),
        );

      guestRows = await db
        .select({ id: guestsTable.id, name: guestsTable.name })
        .from(guestsTable)
        .where(eq(guestsTable.restaurantId, id));
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_TABLE_STATUS_FAILED", {
        restaurantLookupId: id,
        date: today,
      });
    }

    const guestNameById = new Map(guestRows.map((guest) => [guest.id, guest.name]));

    const activeReservations = todayReservations
      .map((reservation) => ({
        ...reservation,
        guestName: guestNameById.get(reservation.guestId) ?? null,
      }))
      .filter((r) => ["pending", "confirmed", "seated"].includes(r.status));

    const result = allTables.map((table) => {
      // Find reservations that reference this table
      const matching = activeReservations.filter((r) => {
        const tIds = (r.tableIds as string[] | null) ?? [];
        return tIds.includes(table.id);
      });

      // Check for seated (occupied) first, then confirmed/pending (reserved)
      const seated = matching.find((r) => r.status === "seated");
      if (seated) {
        return {
          tableId: table.id,
          tableName: table.name,
          seats: table.maxSeats,
          status: "occupied" as const,
          reservation: {
            id: seated.id,
            guestName: seated.guestName ?? "---",
            partySize: seated.partySize,
            timeStart: (seated.timeStart as string).slice(0, 5),
          },
        };
      }

      const reserved = matching.find(
        (r) => r.status === "confirmed" || r.status === "pending",
      );
      if (reserved) {
        return {
          tableId: table.id,
          tableName: table.name,
          seats: table.maxSeats,
          status: "reserved" as const,
          reservation: {
            id: reserved.id,
            guestName: reserved.guestName ?? "---",
            partySize: reserved.partySize,
            timeStart: (reserved.timeStart as string).slice(0, 5),
          },
        };
      }

      return {
        tableId: table.id,
        tableName: table.name,
        seats: table.maxSeats,
        status: "available" as const,
      };
    });

    return result;
  });

  // DELETE /:id/reset-reservations — delete all reservations for this restaurant (testing/pilot)
  app.delete("/:id/reset-reservations", async (request, reply) => {
    const { id } = request.params as { id: string };
    const err = enforceTenant(request.user!, id) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    let restaurant: typeof restaurants.$inferSelect | undefined;
    try {
      [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, id))
        .limit(1);
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_RESET_RESERVATIONS_FAILED", {
        restaurantLookupId: id,
        stage: "restaurant_lookup",
      });
    }

    if (!restaurant) {
      return sendRestaurantError(
        request,
        reply,
        404,
        "Restaurant not found",
        "RESTAURANT_NOT_FOUND",
        { restaurantLookupId: id },
      );
    }

    let result: Array<{ id: string }>;
    try {
      result = await db
        .delete(reservations)
        .where(eq(reservations.restaurantId, id))
        .returning({ id: reservations.id });
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_RESET_RESERVATIONS_FAILED", {
        restaurantLookupId: id,
        stage: "reservation_delete",
      });
    }

    return { deleted: result.length };
  });

  // GET /:id/tables — tables for restaurant
  app.get("/:id/tables", async (request, reply) => {
    const { id } = request.params as { id: string };
    const err = enforceTenant(request.user!, id);
    if (err) {
      return sendRestaurantError(
        request,
        reply,
        403,
        err,
        "RESTAURANT_FORBIDDEN",
        { restaurantLookupId: id },
      );
    }

    let rows: Array<typeof tables.$inferSelect>;
    try {
      rows = await db
        .select()
        .from(tables)
        .where(and(eq(tables.restaurantId, id), eq(tables.isActive, true)));
    } catch (error: unknown) {
      return sendCaughtRestaurantError(request, reply, error, "RESTAURANT_TABLES_FAILED", {
        restaurantLookupId: id,
      });
    }

    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      minSeats: t.minSeats,
      maxSeats: t.maxSeats,
      zone: t.zone,
      isActive: t.isActive,
    }));
  });
}
