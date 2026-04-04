import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { authMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { reservationRoutes } from "./routes/reservations.js";
import { guestRoutes } from "./routes/guests.js";
import { tableRoutes } from "./routes/tables.js";
import { restaurantRoutes } from "./routes/restaurants.js";
import { createReminderWorker } from "./queue/reminder.worker.js";
import { createSummaryWorker } from "./queue/summary.worker.js";
import { summaryQueue } from "./queue/index.js";
import { db } from "./db/index.js";
import { restaurants } from "./db/schema.js";
import { eq } from "drizzle-orm";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN });

// Auth middleware (runs before all routes)
await app.register(authMiddleware);

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/api/v1/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// API routes
await app.register(authRoutes, { prefix: "/api/v1/auth" });
await app.register(reservationRoutes, { prefix: "/api/v1/reservations" });
await app.register(guestRoutes, { prefix: "/api/v1/guests" });
await app.register(tableRoutes, { prefix: "/api/v1/tables" });
await app.register(restaurantRoutes, { prefix: "/api/v1/restaurants" });

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`Sable API running on http://${env.API_HOST}:${env.API_PORT}`);

  // Start BullMQ workers
  const reminderWorker = createReminderWorker();
  const summaryWorker = createSummaryWorker();
  console.log("BullMQ workers started: reminder, summary");

  // Schedule daily summary for BFF Ra'anana (repeating cron job)
  const [bffRestaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.slug, "bff-raanana"))
    .limit(1);

  if (bffRestaurant) {
    await summaryQueue.add(
      "daily-summary",
      { restaurantId: bffRestaurant.id },
      {
        repeat: {
          pattern: "0 23 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `daily-summary-${bffRestaurant.id}`,
      },
    );
    console.log(`Scheduled daily summary for BFF Ra'anana (${bffRestaurant.id}) at 23:00 Asia/Jerusalem`);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await reminderWorker.close();
    await summaryWorker.close();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
