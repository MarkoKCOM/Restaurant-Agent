import type { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { restaurants, reservations, tables, guests } from "../db/schema.js";
import { getDailySummary } from "../services/summary.service.js";

export async function restaurantRoutes(app: FastifyInstance) {
  // GET / — list all restaurants
  app.get("/", async () => {
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
  });

  // GET /:id — restaurant details
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: "Restaurant not found" });
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
    };
  });

  // PATCH /:id — update restaurant settings
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    const allowed = [
      "name",
      "phone",
      "email",
      "address",
      "description",
      "operatingHours",
      "widgetConfig",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(restaurants)
      .set(updates)
      .where(eq(restaurants.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "Restaurant not found" });
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      address: updated.address,
      phone: updated.phone,
      email: updated.email,
      operatingHours: updated.operatingHours,
      widgetConfig: updated.widgetConfig,
    };
  });

  // GET /:id/dashboard — dashboard snapshot for today
  app.get("/:id/dashboard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const today = new Date().toISOString().slice(0, 10);

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!restaurant) {
      return reply.status(404).send({ error: "Restaurant not found" });
    }

    const todayReservations = await db
      .select()
      .from(reservations)
      .where(
        and(eq(reservations.restaurantId, id), eq(reservations.date, today)),
      )
      .orderBy(reservations.timeStart);

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

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);

    if (!restaurant) {
      return reply.status(404).send({ error: "Restaurant not found" });
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);
    const summary = await getDailySummary(id, targetDate);
    return summary;
  });

  // GET /:id/table-status — live table status for today
  app.get("/:id/table-status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM

    // Get all active tables
    const allTables = await db
      .select()
      .from(tables)
      .where(and(eq(tables.restaurantId, id), eq(tables.isActive, true)));

    // Get today's reservations that aren't cancelled/no_show/completed
    const todayReservations = await db
      .select({
        id: reservations.id,
        guestId: reservations.guestId,
        date: reservations.date,
        timeStart: reservations.timeStart,
        timeEnd: reservations.timeEnd,
        partySize: reservations.partySize,
        tableIds: reservations.tableIds,
        status: reservations.status,
        guestName: guests.name,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .where(
        and(
          eq(reservations.restaurantId, id),
          eq(reservations.date, today),
        ),
      );

    const activeReservations = todayReservations.filter(
      (r) => ["pending", "confirmed", "seated"].includes(r.status),
    );

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
            timeStart: seated.timeStart.slice(0, 5),
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
            timeStart: reserved.timeStart.slice(0, 5),
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

  // GET /:id/tables — tables for restaurant
  app.get("/:id/tables", async (request) => {
    const { id } = request.params as { id: string };
    const rows = await db
      .select()
      .from(tables)
      .where(and(eq(tables.restaurantId, id), eq(tables.isActive, true)));

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
