import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminUsers, restaurants } from "../db/schema.js";
import { requireSuperAdmin } from "../middleware/auth.js";

export async function adminRoutes(app: FastifyInstance) {
  // GET /restaurants — list all restaurants (super_admin only)
  app.get("/restaurants", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return reply.status(403).send({ error: err });

    const rows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        cuisineType: restaurants.cuisineType,
        address: restaurants.address,
        phone: restaurants.phone,
        package: restaurants.package,
        createdAt: restaurants.createdAt,
        adminCount: sql<number>`count(${adminUsers.id})::int`,
      })
      .from(restaurants)
      .leftJoin(
        adminUsers,
        and(eq(adminUsers.restaurantId, restaurants.id), eq(adminUsers.role, "admin")),
      )
      .groupBy(
        restaurants.id,
        restaurants.name,
        restaurants.slug,
        restaurants.cuisineType,
        restaurants.address,
        restaurants.phone,
        restaurants.package,
        restaurants.createdAt,
      )
      .orderBy(restaurants.name);

    return rows;
  });
}
