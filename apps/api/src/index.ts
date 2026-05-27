import Fastify from "fastify";
import cors from "@fastify/cors";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { reservationRoutes } from "./routes/reservations.js";
import { guestRoutes } from "./routes/guests.js";
import { tableRoutes } from "./routes/tables.js";
import { restaurantRoutes } from "./routes/restaurants.js";
import { gamificationRoutes } from "./routes/gamification.js";
import { loyaltyRoutes } from "./routes/loyalty.js";
import { engagementRoutes } from "./routes/engagement.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { visitRoutes, feedbackRoutes } from "./routes/visits.js";
import { waitlistRoutes } from "./routes/waitlist.js";
import { chatRoutes } from "./routes/chat.js";
import { agentRoutes } from "./routes/agent.js";
import { adminRoutes } from "./routes/admin.js";
import { createReminderWorker } from "./queue/reminder.worker.js";
import { createSummaryWorker } from "./queue/summary.worker.js";
import { createEngagementWorker } from "./queue/engagement.worker.js";
import { createCampaignWorker } from "./queue/campaign.worker.js";
import { summaryQueue, engagementQueue } from "./queue/index.js";
import { db } from "./db/index.js";
import { restaurants } from "./db/schema.js";

function getRequestId(req: IncomingMessage): string {
  const incoming = req.headers["x-request-id"];
  const value = Array.isArray(incoming) ? incoming[0] : incoming;

  if (value && /^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    return value;
  }

  return randomUUID();
}

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
  genReqId: getRequestId,
});

await app.register(cors, {
  origin: true,
  exposedHeaders: ["x-request-id"],
});

app.addHook("onSend", async (request, reply, payload) => {
  reply.header("x-request-id", request.id);
  return payload;
});

app.setErrorHandler((error, request, reply) => {
  const err = error as {
    statusCode?: number;
    code?: string;
    message?: string;
  };
  const isValidationError = error instanceof ZodError;
  const statusCode = isValidationError ? 400 : (err.statusCode ?? 500);
  const isServerError = statusCode >= 500;
  const code = isValidationError
    ? "VALIDATION_ERROR"
    : (err.code ?? (isServerError ? "INTERNAL_ERROR" : "REQUEST_ERROR"));
  const message = err.message ?? "Unknown error";

  const logPayload = {
    err: error,
    code,
    requestId: request.id,
    method: request.method,
    url: request.url,
    userId: request.user?.id,
    restaurantId: request.user?.restaurantId,
    role: request.user?.role,
  };

  if (isServerError) {
    request.log.error(logPayload, "Unhandled API error");
  } else {
    request.log.warn(logPayload, "Request rejected");
  }

  return reply.status(statusCode).send({
    error: isServerError ? "Internal server error" : message,
    code,
    requestId: request.id,
    ...(isValidationError ? { details: error.flatten() } : {}),
  });
});

app.setNotFoundHandler((request, reply) => {
  request.log.warn({
    code: "ROUTE_NOT_FOUND",
    requestId: request.id,
    method: request.method,
    url: request.url,
    userId: request.user?.id,
    restaurantId: request.user?.restaurantId,
    role: request.user?.role,
  }, "Route not found");

  return reply.status(404).send({
    error: "Route not found",
    code: "ROUTE_NOT_FOUND",
    requestId: request.id,
  });
});

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
await app.register(gamificationRoutes, { prefix: "/api/v1/gamification" });
await app.register(loyaltyRoutes, { prefix: "/api/v1/loyalty" });
await app.register(engagementRoutes, { prefix: "/api/v1/engagement" });
await app.register(campaignRoutes, { prefix: "/api/v1/campaigns" });
await app.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
await app.register(visitRoutes, { prefix: "/api/v1/visits" });
await app.register(feedbackRoutes, { prefix: "/api/v1/feedback" });
await app.register(waitlistRoutes, { prefix: "/api/v1/waitlist" });
await app.register(chatRoutes, { prefix: "/api/v1/chat" });
await app.register(agentRoutes, { prefix: "/api/v1/agent" });
await app.register(adminRoutes, { prefix: "/api/v1/admin" });

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(
    { host: env.API_HOST, port: env.API_PORT, logLevel: env.LOG_LEVEL },
    "OpenSeat API running",
  );

  // Start BullMQ workers
  const reminderWorker = createReminderWorker(app.log);
  const summaryWorker = createSummaryWorker(app.log);
  const engagementWorker = createEngagementWorker(app.log);
  const campaignWorker = createCampaignWorker(app.log);
  app.log.info("BullMQ workers started: reminder, summary, engagement, campaign");

  // Schedule recurring jobs for all active restaurants
  const allRestaurants = await db.select().from(restaurants);

  for (const restaurant of allRestaurants) {
    await summaryQueue.add(
      "daily-summary",
      { restaurantId: restaurant.id },
      {
        repeat: {
          pattern: "0 23 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `daily-summary-${restaurant.id}`,
      },
    );

    await engagementQueue.add(
      "win-back-check",
      { type: "win_back_cron", restaurantId: restaurant.id },
      {
        repeat: {
          pattern: "0 10 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `win-back-cron-${restaurant.id}`,
      },
    );

    await engagementQueue.add(
      "birthday-check",
      { type: "birthday_cron", restaurantId: restaurant.id },
      {
        repeat: {
          pattern: "0 9 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `birthday-cron-${restaurant.id}`,
      },
    );

    await engagementQueue.add(
      "anniversary-check",
      { type: "anniversary_cron", restaurantId: restaurant.id },
      {
        repeat: {
          pattern: "15 9 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `anniversary-cron-${restaurant.id}`,
      },
    );

    await engagementQueue.add(
      "birthday-week-challenge-check",
      { type: "birthday_week_challenge_cron", restaurantId: restaurant.id },
      {
        repeat: {
          pattern: "30 9 * * *",
          tz: "Asia/Jerusalem",
        },
        jobId: `birthday-week-challenge-cron-${restaurant.id}`,
      },
    );

    app.log.info(
      { restaurantId: restaurant.id, restaurantName: restaurant.name },
      "Scheduled recurring jobs for restaurant",
    );
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down gracefully");
    await reminderWorker.close();
    await summaryWorker.close();
    await engagementWorker.close();
    await campaignWorker.close();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
