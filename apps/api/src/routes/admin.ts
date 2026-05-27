import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminUsers, restaurants } from "../db/schema.js";
import { requireSuperAdmin } from "../middleware/auth.js";
import { getDiagnosticsReport } from "../services/diagnostics.service.js";

function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;
}

function sendAdminError(
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

function sendCaughtAdminError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  code: string,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : "Admin operation failed";
  return sendAdminError(request, reply, 500, message, code, {
    ...context,
    err: error,
  });
}

export async function adminRoutes(app: FastifyInstance) {
  // GET /diagnostics — dependency health snapshot (super_admin only)
  app.get("/diagnostics", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return sendAdminError(request, reply, 403, err, "ADMIN_FORBIDDEN");

    try {
      const report = await getDiagnosticsReport();
      return reply.status(200).send({
        ...report,
        requestId: request.id,
      });
    } catch (error: unknown) {
      return sendCaughtAdminError(request, reply, error, "ADMIN_DIAGNOSTICS_FAILED");
    }
  });

  // GET /restaurants — list all restaurants (super_admin only)
  app.get("/restaurants", async (request, reply) => {
    const user = request.user!;
    const err = requireSuperAdmin(user);
    if (err) return sendAdminError(request, reply, 403, err, "ADMIN_FORBIDDEN");

    let restaurantRows: Array<{
      id: string;
      name: string;
      slug: string;
      cuisineType: string | null;
      address: string | null;
      phone: string | null;
      whatsappNumber: string | null;
      ownerPhone: string | null;
      ownerWhatsapp: string | null;
      package: "starter" | "growth";
      createdAt: Date;
    }>;
    let adminCountRows: Array<{ restaurantId: string | null; adminCount: number }>;
    try {
      [restaurantRows, adminCountRows] = await Promise.all([
        db
          .select({
            id: restaurants.id,
            name: restaurants.name,
            slug: restaurants.slug,
            cuisineType: restaurants.cuisineType,
            address: restaurants.address,
            phone: restaurants.phone,
            whatsappNumber: restaurants.whatsappNumber,
            ownerPhone: restaurants.ownerPhone,
            ownerWhatsapp: restaurants.ownerWhatsapp,
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
    } catch (error: unknown) {
      return sendCaughtAdminError(request, reply, error, "ADMIN_RESTAURANTS_LIST_FAILED");
    }

    const adminCountByRestaurant = new Map(
      adminCountRows
        .filter((row): row is { restaurantId: string; adminCount: number } => row.restaurantId !== null)
        .map((row) => [row.restaurantId, row.adminCount]),
    );

    return restaurantRows.map((restaurant) => ({
      ...restaurant,
      phoneMasked: maskPhone(restaurant.phone),
      whatsappNumberMasked: maskPhone(restaurant.whatsappNumber),
      ownerPhoneMasked: maskPhone(restaurant.ownerPhone),
      ownerWhatsappMasked: maskPhone(restaurant.ownerWhatsapp),
      ownerWhatsappConfigured: Boolean(restaurant.ownerWhatsapp?.trim()),
      phone: undefined,
      whatsappNumber: undefined,
      ownerPhone: undefined,
      ownerWhatsapp: undefined,
      adminCount: adminCountByRestaurant.get(restaurant.id) ?? 0,
    }));
  });
}
