import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminUsers, restaurants } from "../db/schema.js";
import { requireSuperAdmin } from "../middleware/auth.js";
import { getDiagnosticsReport } from "../services/diagnostics.service.js";

function sendAdminError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  message: string,
  code: string,
) {
  const logPayload = {
    code,
    requestId: request.id,
    statusCode,
    userId: request.user?.id,
    restaurantId: request.user?.restaurantId,
    role: request.user?.role,
  };

  if (statusCode >= 500) {
    request.log.error(logPayload, "Admin request failed");
  } else {
    request.log.warn(logPayload, "Admin request rejected");
  }

  return reply.status(statusCode).send({
    error: message,
    code,
    requestId: request.id,
  });
}

export async function adminRoutes(app: FastifyInstance) {
  // GET /diagnostics — dependency health snapshot (super_admin only)
  app.get("/diagnostics", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return sendAdminError(request, reply, 403, err, "ADMIN_FORBIDDEN");

    const report = await getDiagnosticsReport();
    const statusCode = report.status === "ok" ? 200 : 503;
    return reply.status(statusCode).send({
      ...report,
      requestId: request.id,
    });
  });

  // GET /restaurants — list all restaurants (super_admin only)
  app.get("/restaurants", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return sendAdminError(request, reply, 403, err, "ADMIN_FORBIDDEN");

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
