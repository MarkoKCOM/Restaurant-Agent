import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  handleMessage,
  resetConversation,
  type AgentRequest,
} from "../services/agent.service.js";

const messageSchema: z.ZodType<AgentRequest> = z.object({
  restaurantId: z.string().uuid(),
  senderId: z.string().min(1),
  message: z.string().min(1),
  guestPhone: z.string().optional(),
  guestName: z.string().optional(),
});

export async function agentRoutes(app: FastifyInstance) {
  // POST /message — send a message to the agent
  app.post("/message", async (request, reply) => {
    const body: AgentRequest = messageSchema.parse(request.body);

    try {
      const result = await handleMessage(body);
      return {
        reply: result.reply,
        language: result.language,
        toolsUsed: result.toolsUsed,
      };
    } catch (err) {
      app.log.error(err, "Agent error");
      reply.code(500);
      return { error: "Agent failed to process message" };
    }
  });

  // POST /reset — clear conversation context
  app.post("/reset", async (request) => {
    const { restaurantId, senderId } = z
      .object({ restaurantId: z.string().uuid(), senderId: z.string().min(1) })
      .parse(request.body);

    await resetConversation(restaurantId, senderId);
    return { ok: true };
  });
}
