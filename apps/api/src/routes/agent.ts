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

function classifyAgentError(err: unknown): { code: string; statusCode: number; message: string } {
  const message = err instanceof Error ? err.message : "Agent failed to process message";

  if (message.includes("OPENROUTER_API_KEY")) {
    return { code: "AGENT_LLM_CONFIG_MISSING", statusCode: 500, message: "Agent LLM configuration is missing" };
  }
  if (err instanceof Error && err.name === "AbortError") {
    return { code: "AGENT_LLM_TIMEOUT", statusCode: 504, message: "Agent LLM request timed out" };
  }
  if (message.startsWith("LLM error")) {
    return { code: "AGENT_LLM_REQUEST_FAILED", statusCode: 502, message: "Agent LLM request failed" };
  }

  return { code: "AGENT_ERROR", statusCode: 500, message: "Agent failed to process message" };
}

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
      const classified = classifyAgentError(err);
      request.log.error(
        {
          err,
          requestId: request.id,
          code: classified.code,
          statusCode: classified.statusCode,
          restaurantId: body.restaurantId,
          senderId: body.senderId,
          messageLength: body.message.length,
        },
        "Agent request failed",
      );
      reply.code(classified.statusCode);
      return {
        error: classified.message,
        code: classified.code,
        requestId: request.id,
      };
    }
  });

  // POST /reset — clear conversation context
  app.post("/reset", async (request, reply) => {
    const { restaurantId, senderId } = z
      .object({ restaurantId: z.string().uuid(), senderId: z.string().min(1) })
      .parse(request.body);

    try {
      await resetConversation(restaurantId, senderId);
      return { ok: true };
    } catch (err) {
      request.log.error(
        {
          err,
          requestId: request.id,
          code: "AGENT_RESET_FAILED",
          statusCode: 500,
          restaurantId,
          senderId,
        },
        "Agent reset failed",
      );
      reply.code(500);
      return {
        error: "Agent conversation reset failed",
        code: "AGENT_RESET_FAILED",
        requestId: request.id,
      };
    }
  });

  // POST /debug/membership-intent — deterministic WhatsApp membership intent probe
  app.post("/debug/membership-intent", async (request) => {
    const { message } = membershipIntentDebugSchema.parse(request.body);
    return debugMembershipIntent(message);
  });
}
