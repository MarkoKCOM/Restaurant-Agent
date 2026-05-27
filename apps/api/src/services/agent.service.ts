/**
 * OpenSeat AI Agent — Phase 1b
 *
 * Handles guest messages from any channel (Telegram, WhatsApp, web).
 * Flow: message → conversation context → LLM with tools → execute → respond
 */

import { Redis } from "ioredis";
import { and, eq } from "drizzle-orm";
import { env } from "../env.js";
import { agentTools, executeTool } from "./agent-tools.js";
import { db } from "../db/index.js";
import { guests } from "../db/schema.js";
import { debugMembershipIntent } from "./membership-intent-debug.service.js";

const redis = new Redis(env.REDIS_URL);

const CONTEXT_TTL = 86400; // 24 hours
const MAX_HISTORY = 20; // keep last 20 messages in context

// ── Conversation Context ────────────────────────────

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ConversationContext {
  restaurantId: string;
  guestPhone?: string;
  guestName?: string;
  language: string;
  messages: Message[];
}

export interface AgentToolTraceEvent {
  tool: string;
  success: boolean;
  elapsedMs: number;
  errorCode?: "AGENT_TOOL_ARGS_INVALID" | "AGENT_TOOL_EXECUTION_FAILED";
  error?: string;
}

function contextKey(restaurantId: string, senderId: string): string {
  return `agent:conv:${restaurantId}:${senderId}`;
}

async function loadContext(restaurantId: string, senderId: string): Promise<ConversationContext> {
  const raw = await redis.get(contextKey(restaurantId, senderId));
  if (raw) {
    return JSON.parse(raw);
  }
  return {
    restaurantId,
    language: "he",
    messages: [],
  };
}

async function saveContext(restaurantId: string, senderId: string, ctx: ConversationContext): Promise<void> {
  // Trim to max history
  if (ctx.messages.length > MAX_HISTORY) {
    ctx.messages = ctx.messages.slice(-MAX_HISTORY);
  }
  await redis.set(contextKey(restaurantId, senderId), JSON.stringify(ctx), "EX", CONTEXT_TTL);
}

// ── Language Detection ──────────────────────────────

const HEBREW_RANGE = /[\u0590-\u05FF]/;
const ARABIC_RANGE = /[\u0600-\u06FF]/;

function detectLanguage(text: string): string {
  if (HEBREW_RANGE.test(text)) return "he";
  if (ARABIC_RANGE.test(text)) return "ar";
  return "en";
}

// ── System Prompt ───────────────────────────────────

function buildSystemPrompt(ctx: ConversationContext): string {
  const lang = ctx.language;
  const langInstructions = lang === "he"
    ? "Respond in Hebrew. Use casual, friendly tone."
    : lang === "ar"
      ? "Respond in Arabic. Use polite, friendly tone."
      : "Respond in English. Use casual, friendly tone.";

  return `You are OpenSeat, an AI assistant for a restaurant. You help guests make reservations, check availability, join the waitlist, answer questions about the restaurant, and support simple membership-club requests.

${langInstructions}

Restaurant ID: ${ctx.restaurantId}
${ctx.guestPhone ? `Guest phone: ${ctx.guestPhone}` : ""}
${ctx.guestName ? `Guest name: ${ctx.guestName}` : ""}

Rules:
- Be concise. Keep responses under 3 sentences unless the guest asks for details.
- When a guest wants to book, ask for: date, time preference, party size, and their name if unknown.
- If no slots are available, offer to add them to the waitlist.
- Use 24-hour time format (e.g., 19:00, not 7 PM).
- Today's date: ${new Date().toISOString().slice(0, 10)}
- Always confirm booking details before creating a reservation.
- If a guest asks about member points, tier, stamp progress, active claims, or available rewards, use the membership summary tool.
- If a guest asks to invite a friend or get a referral code, use the referral tool and share the short code/copy naturally. Do not invent a specific reward beyond the active referral copy.
- If a guest asks to stop club/promotional messages, use the membership messaging opt-out tool. Explain that essential reservation updates still continue.
- Do not promise a reward that is not visible in the membership summary or referral copy.
- If the guest says something unrelated to the restaurant, politely redirect.`;
}

// ── LLM Call ────────────────────────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LLM_TIMEOUT_MS = 30_000;

async function callLLM(messages: Message[], tools: unknown[]): Promise<{
  content: string | null;
  tool_calls?: ToolCall[];
}> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.AGENT_MODEL,
        max_tokens: 1024,
        messages,
        tools,
        tool_choice: "auto",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error ${res.status}: ${errText}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }> };
  const choice = data.choices?.[0]?.message;
  return {
    content: choice?.content ?? null,
    tool_calls: choice?.tool_calls,
  };
}

// ── Agent Loop ──────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

export interface AgentRequest {
  restaurantId: string;
  senderId: string; // phone number or telegram user ID
  message: string;
  guestPhone?: string;
  guestName?: string;
}

export interface AgentResponse {
  reply: string;
  language: string;
  toolsUsed: string[];
  diagnostics: {
    llmRounds: number;
    toolTrace: AgentToolTraceEvent[];
    deterministicAction?: {
      type: "campaign_opt_out";
      guestId?: string;
      phone: string;
      success: boolean;
      reason?: string;
    };
  };
}

async function applyDeterministicCampaignOptOut(params: {
  restaurantId: string;
  phone: string;
}): Promise<NonNullable<AgentResponse["diagnostics"]["deterministicAction"]>> {
  const [existing] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.restaurantId, params.restaurantId), eq(guests.phone, params.phone)))
    .limit(1);

  if (!existing) {
    return {
      type: "campaign_opt_out",
      phone: params.phone,
      success: false,
      reason: "guest_not_found",
    };
  }

  await db
    .update(guests)
    .set({ optedOutCampaigns: true, updatedAt: new Date() })
    .where(eq(guests.id, existing.id));

  return {
    type: "campaign_opt_out",
    guestId: existing.id,
    phone: params.phone,
    success: true,
  };
}

export async function handleMessage(req: AgentRequest): Promise<AgentResponse> {
  const { restaurantId, senderId, message, guestPhone, guestName } = req;

  // Load conversation context
  const ctx = await loadContext(restaurantId, senderId);
  ctx.restaurantId = restaurantId;
  if (guestPhone) ctx.guestPhone = guestPhone;
  if (guestName) ctx.guestName = guestName;
  ctx.language = detectLanguage(message);

  // Add user message
  ctx.messages.push({ role: "user", content: message });

  const intent = debugMembershipIntent(message);
  const inferredPhone = guestPhone ?? senderId;
  if (intent.intent === "messaging_opt_out") {
    const startedAt = Date.now();
    const deterministicAction = await applyDeterministicCampaignOptOut({
      restaurantId,
      phone: inferredPhone,
    });
    const reply = deterministicAction.success
      ? ctx.language === "he"
        ? "הסרתי אותך מהודעות מועדון ומבצעים. עדכונים חיוניים להזמנות עדיין יישלחו."
        : "You're opted out of club and promotional messages. Essential reservation updates will still continue."
      : ctx.language === "he"
        ? "לא מצאתי פרופיל חבר למספר הזה, אבל לא אשלח הודעות מועדון ללא אישור."
        : "I couldn't find a member profile for this number, but I will not send club messages without consent.";

    ctx.messages.push({ role: "assistant", content: reply });
    await saveContext(restaurantId, senderId, ctx);

    return {
      reply,
      language: ctx.language,
      toolsUsed: ["set_membership_messaging_opt_out"],
      diagnostics: {
        llmRounds: 0,
        toolTrace: [{
          tool: "deterministic_campaign_opt_out",
          success: deterministicAction.success,
          elapsedMs: Date.now() - startedAt,
          error: deterministicAction.success ? undefined : deterministicAction.reason,
        }],
        deterministicAction,
      },
    };
  }

  // Build messages for LLM
  const systemMsg: Message = { role: "system", content: buildSystemPrompt(ctx) };
  const llmMessages = [systemMsg, ...ctx.messages];

  // Tool definitions for OpenAI-compatible format
  const toolDefs = agentTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const toolsUsed: string[] = [];
  const toolTrace: AgentToolTraceEvent[] = [];

  // Agent loop — call LLM, execute tools, repeat until text response
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await callLLM(llmMessages, toolDefs);

    if (result.tool_calls && result.tool_calls.length > 0) {
      // Add assistant message with tool calls
      const assistantMsg: Message = {
        role: "assistant",
        content: result.content ?? "",
        tool_calls: result.tool_calls,
      };
      llmMessages.push(assistantMsg);
      ctx.messages.push(assistantMsg);

      // Execute each tool call
      for (const tc of result.tool_calls) {
        const toolName = tc.function.name;
        toolsUsed.push(toolName);

        let toolResult: string;
        const startedAt = Date.now();
        let toolArgs: Record<string, unknown>;
        try {
          const parsedArgs = JSON.parse(tc.function.arguments) as unknown;
          if (!parsedArgs || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
            throw new Error("Tool arguments must be a JSON object");
          }
          toolArgs = parsedArgs as Record<string, unknown>;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          toolTrace.push({
            tool: toolName,
            success: false,
            elapsedMs: Date.now() - startedAt,
            errorCode: "AGENT_TOOL_ARGS_INVALID",
            error: errorMessage,
          });
          toolResult = JSON.stringify({ error: "Invalid tool arguments", code: "AGENT_TOOL_ARGS_INVALID" });

          const toolMsg: Message = {
            role: "tool",
            content: toolResult,
            tool_call_id: tc.id,
          };
          llmMessages.push(toolMsg);
          ctx.messages.push(toolMsg);
          continue;
        }

        try {
          const output = await executeTool(toolName, toolArgs, ctx);
          toolResult = typeof output === "string" ? output : JSON.stringify(output);
          toolTrace.push({
            tool: toolName,
            success: true,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          toolTrace.push({
            tool: toolName,
            success: false,
            elapsedMs: Date.now() - startedAt,
            errorCode: "AGENT_TOOL_EXECUTION_FAILED",
            error: errorMessage,
          });
          toolResult = JSON.stringify({ error: errorMessage, code: "AGENT_TOOL_EXECUTION_FAILED" });
        }

        const toolMsg: Message = {
          role: "tool",
          content: toolResult,
          tool_call_id: tc.id,
        };
        llmMessages.push(toolMsg);
        ctx.messages.push(toolMsg);
      }

      continue; // loop back to LLM with tool results
    }

    // No tool calls — we have a text response
    const reply = result.content || (ctx.language === "he" ? "סליחה, לא הבנתי. אפשר לנסות שוב?" : "Sorry, I didn't understand. Could you try again?");
    ctx.messages.push({ role: "assistant", content: reply });
    await saveContext(restaurantId, senderId, ctx);

    return {
      reply,
      language: ctx.language,
      toolsUsed,
      diagnostics: {
        llmRounds: round + 1,
        toolTrace,
      },
    };
  }

  // Max rounds exceeded
  const fallback = ctx.language === "he"
    ? "סליחה, נתקלתי בבעיה. אפשר לנסות שוב?"
    : "Sorry, I ran into an issue. Could you try again?";
  ctx.messages.push({ role: "assistant", content: fallback });
  await saveContext(restaurantId, senderId, ctx);

  return {
    reply: fallback,
    language: ctx.language,
    toolsUsed,
    diagnostics: {
      llmRounds: MAX_TOOL_ROUNDS,
      toolTrace,
    },
  };
}

// ── Reset Conversation ──────────────────────────────

export async function resetConversation(restaurantId: string, senderId: string): Promise<void> {
  await redis.del(contextKey(restaurantId, senderId));
}
