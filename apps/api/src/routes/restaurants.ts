import type { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { restaurants, reservations, tables } from "../db/schema.js";

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

    return {
      today: {
        reservations: totalReservations,
        covers: totalCovers,
        cancellations,
        noShows,
      },
      reservationIds: todayReservations.map((r) => r.id),
    };
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
