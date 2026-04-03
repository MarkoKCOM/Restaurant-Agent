import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { reservationRoutes } from "./routes/reservations.js";
import { guestRoutes } from "./routes/guests.js";
import { tableRoutes } from "./routes/tables.js";
import { restaurantRoutes } from "./routes/restaurants.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN });

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// API routes
await app.register(reservationRoutes, { prefix: "/api/v1/reservations" });
await app.register(guestRoutes, { prefix: "/api/v1/guests" });
await app.register(tableRoutes, { prefix: "/api/v1/tables" });
await app.register(restaurantRoutes, { prefix: "/api/v1/restaurants" });

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`Sable API running on http://${env.API_HOST}:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
