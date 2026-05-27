import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  handleMessage,
  resetConversation,
  type AgentRequest,
} from "../services/agent.service.js";
import { debugMembershipIntent } from "../services/membership-intent-debug.service.js";

const messageSchema = z.object({
  restaurantId: z.string().uuid(),
  senderId: z.string().min(1),
  message: z.string().min(1),
  guestPhone: z.string().optional(),
  guestName: z.string().optional(),
});

const membershipIntentDebugSchema = z.object({
  message: z.string().min(1),
});

export async function agentRoutes(app: FastifyInstance) {
  // POST /message — send a message to the agent
  app.post("/message", async (request, reply) => {
    const body = messageSchema.parse(request.body) as AgentRequest;

    try {
      const result = await handleMessage(body);
      request.log.info(
        {
          restaurantId: body.restaurantId,
          senderId: body.senderId,
          language: result.language,
          toolsUsed: result.toolsUsed,
          toolTrace: result.diagnostics.toolTrace,
          llmRounds: result.diagnostics.llmRounds,
        },
        "Agent message processed",
      );
      return {
        reply: result.reply,
        language: result.language,
        toolsUsed: result.toolsUsed,
        diagnostics: {
          requestId: request.id,
          ...result.diagnostics,
        },
      };
    } catch (err) {
      request.log.error(
        {
          err,
          requestId: request.id,
          restaurantId: body.restaurantId,
          senderId: body.senderId,
          messageLength: body.message.length,
        },
        "Agent error",
      );
      reply.code(500);
      return {
        error: "Agent failed to process message",
        code: "AGENT_ERROR",
        requestId: request.id,
      };
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

  // POST /debug/membership-intent — deterministic WhatsApp membership intent probe
  app.post("/debug/membership-intent", async (request) => {
    const { message } = membershipIntentDebugSchema.parse(request.body);
    return debugMembershipIntent(message);
  });
}
