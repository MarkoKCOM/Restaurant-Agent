import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface AuthUser {
  id: string;
  email: string;
  restaurantId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const PUBLIC_ROUTES: Array<{ method?: string; path: string; prefix?: boolean; suffix?: string }> = [
  { path: "/health" },
  { path: "/api/v1/health" },
  { path: "/api/v1/auth/login" },
  { method: "GET", path: "/api/v1/reservations/availability" },
  { method: "GET", path: "/api/v1/restaurants", prefix: true },
  { method: "POST", path: "/api/v1/reservations" },
  { method: "POST", path: "/api/v1/waitlist" },
  { method: "POST", path: "/api/v1/waitlist", prefix: true, suffix: "/accept" },
];

function isPublicRoute(method: string, url: string): boolean {
  // Strip query string for matching
  const path = url.split("?")[0];

  for (const route of PUBLIC_ROUTES) {
    if (route.method && route.method !== method.toUpperCase()) continue;
    if (route.prefix && route.suffix) {
      // Match: path starts with route.path + "/" and ends with route.suffix
      if (path.startsWith(route.path + "/") && path.endsWith(route.suffix)) return true;
    } else if (route.prefix) {
      if (path === route.path || path.startsWith(route.path + "/")) return true;
    } else {
      if (path === route.path) return true;
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
      request.user = {
        id: payload.id,
        email: payload.email,
        restaurantId: payload.restaurantId,
      };
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}

export const authMiddleware = fp(authMiddlewarePlugin);
