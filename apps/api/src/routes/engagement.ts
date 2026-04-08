import type { FastifyInstance } from "fastify";
import {
  listEngagementJobs,
  checkWinBack,
} from "../services/engagement.service.js";
import { enforceTenant, requireRestaurantAdmin } from "../middleware/auth.js";

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

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
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

    const err = enforceTenant(request.user!, restaurantId) ?? requireRestaurantAdmin(request.user!);
    if (err) {
      return reply.status(403).send({ error: err });
    }

    const result = await checkWinBack(restaurantId);
    return { result };
  });
}
