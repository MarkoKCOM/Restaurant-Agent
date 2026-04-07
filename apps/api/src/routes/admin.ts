import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminUsers, restaurants } from "../db/schema.js";
import { requireSuperAdmin } from "../middleware/auth.js";

export async function adminRoutes(app: FastifyInstance) {
  // GET /restaurants — list all restaurants (super_admin only)
  app.get("/restaurants", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return reply.status(403).send({ error: err });

    const [restaurantRows, adminCountRows] = await Promise.all([
      db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          slug: restaurants.slug,
          cuisineType: restaurants.cuisineType,
          address: restaurants.address,
          phone: restaurants.phone,
          package: restaurants.package,
          createdAt: restaurants.createdAt,
        })
        .from(restaurants)
        .orderBy(restaurants.name),
      db
        .select({
          restaurantId: adminUsers.restaurantId,
          adminCount: sql<number>`count(*)::int`,
        })
        .from(adminUsers)
        .where(eq(adminUsers.role, "admin"))
        .groupBy(adminUsers.restaurantId),
    ]);

    const adminCountByRestaurant = new Map(
      adminCountRows
        .filter((row): row is { restaurantId: string; adminCount: number } => row.restaurantId !== null)
        .map((row) => [row.restaurantId, row.adminCount]),
    );

    return restaurantRows.map((restaurant) => ({
      ...restaurant,
      adminCount: adminCountByRestaurant.get(restaurant.id) ?? 0,
    }));
  });
}
