import type { FastifyInstance } from "fastify";
import {
  listEngagementJobs,
  checkWinBack,
} from "../services/engagement.service.js";

export async function engagementRoutes(app: FastifyInstance) {
  // GET /jobs — list engagement jobs with optional filters
  app.get("/jobs", async (request, reply) => {
    const { restaurantId, guestId, status } = request.query as {
      restaurantId?: string;
      guestId?: string;
      status?: string;
    };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const jobs = await listEngagementJobs({ restaurantId, guestId, status });
    return { jobs };
  });

  // POST /win-back/check — manually trigger win-back check for a restaurant
  app.post("/win-back/check", async (request, reply) => {
    const { restaurantId } = request.query as { restaurantId?: string };

    if (!restaurantId) {
      reply.code(400);
      return { error: "restaurantId query parameter is required" };
    }

    const result = await checkWinBack(restaurantId);
    return { result };
  });
}
