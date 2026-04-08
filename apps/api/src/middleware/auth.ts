import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export type AdminRole = "admin" | "employee" | "super_admin";

export interface AuthUser {
  id: string;
  email: string;
  restaurantId: string | null;
  role: AdminRole;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const PUBLIC_ROUTES: Array<{
  method?: string;
  path?: string;
  prefix?: boolean;
  suffix?: string;
  pattern?: RegExp;
}> = [
  { path: "/health" },
  { path: "/api/v1/health" },
  { path: "/api/v1/auth/login" },
  { method: "GET", path: "/api/v1/reservations/availability" },
  { method: "GET", path: "/api/v1/restaurants" },
  { method: "GET", pattern: /^\/api\/v1\/restaurants\/[^/]+$/ },
  { method: "POST", path: "/api/v1/reservations" },
  { method: "POST", path: "/api/v1/waitlist" },
  { method: "POST", path: "/api/v1/waitlist", prefix: true, suffix: "/accept" },
  { method: "POST", path: "/api/v1/agent", prefix: true },
];

function isPublicRoute(method: string, url: string): boolean {
  const path = url.split("?")[0];

  for (const route of PUBLIC_ROUTES) {
    if (route.method && route.method !== method.toUpperCase()) continue;
    if (route.pattern && route.pattern.test(path)) return true;
    if (!route.path) continue;

    if (route.prefix && route.suffix) {
      if (path.startsWith(route.path + "/") && path.endsWith(route.suffix)) return true;
    } else if (route.prefix) {
      if (path === route.path || path.startsWith(route.path + "/")) return true;
    } else if (path === route.path) {
      return true;
    }
  }

  return false;
}

async function authMiddlewarePlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicRoute(request.method, request.url)) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      if (payload.role && payload.role !== "admin" && payload.role !== "employee" && payload.role !== "super_admin") {
        throw new Error("Invalid role");
      }
      const role = payload.role ?? "admin";
      const requestedRestaurantId = request.headers["x-restaurant-id"];
      const activeRestaurantId =
        role === "super_admin" && typeof requestedRestaurantId === "string"
          ? requestedRestaurantId
          : payload.restaurantId ?? null;

      request.user = {
        id: payload.id,
        email: payload.email,
        restaurantId: activeRestaurantId,
        role,
      };
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}

export const authMiddleware = fp(authMiddlewarePlugin);

// ── Tenant enforcement helpers ────────────────────────

/**
 * Returns the effective restaurantId for the current request.
 * - Regular admins: always their own restaurantId (ignores any passed id).
 * - Super admins: uses the provided id, or null if none given.
 */
export function resolveRestaurantId(
  user: AuthUser,
  requestedId?: string | null,
): string | null {
  if (user.role === "super_admin") {
    return requestedId ?? user.restaurantId;
  }
  // Normal admin — always scoped to their own restaurant
  return user.restaurantId;
}

/**
 * Guard: ensures a normal admin cannot access a different restaurant.
 * Returns an error string if access is denied, or null if OK.
 */
export function enforceTenant(
  user: AuthUser,
  requestedRestaurantId: string,
): string | null {
  if (user.role === "super_admin") return null;
  if (!user.restaurantId) return "No restaurant assigned";
  if (user.restaurantId !== requestedRestaurantId) {
    return "Forbidden: cannot access another restaurant";
  }
  return null;
}

/**
 * Guard: ensures the user has super_admin role.
 * Returns an error string if not, or null if OK.
 */
export function requireRole(
  user: AuthUser,
  allowedRoles: AdminRole[],
  errorMessage = "Forbidden: insufficient role",
): string | null {
  if (!allowedRoles.includes(user.role)) {
    return errorMessage;
  }
  return null;
}

export function requireOperationalRole(user: AuthUser): string | null {
  return requireRole(
    user,
    ["admin", "employee", "super_admin"],
    "Forbidden: operational role required",
  );
}

export function requireRestaurantAdmin(user: AuthUser): string | null {
  return requireRole(
    user,
    ["admin", "super_admin"],
    "Forbidden: admin role required",
  );
}

export function requireSuperAdmin(user: AuthUser): string | null {
  if (user.role !== "super_admin") {
    return "Forbidden: super_admin role required";
  }
  return null;
}
