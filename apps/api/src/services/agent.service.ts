/**
 * OpenSeat AI Agent — Phase 1b
 *
 * Handles guest messages from any channel (Telegram, WhatsApp, web).
 * Flow: message → conversation context → LLM with tools → execute → respond
 */

import Redis from "ioredis";
import { env } from "../env.js";
import { agentTools, executeTool } from "./agent-tools.js";

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

  return `You are OpenSeat, an AI assistant for a restaurant. You help guests make reservations, check availability, join the waitlist, and answer questions about the restaurant.

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
- If the guest says something unrelated to the restaurant, politely redirect.`;
}

// ── LLM Call ────────────────────────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.AGENT_MODEL || "google/gemini-2.5-flash";

async function callLLM(messages: Message[], tools: unknown[]): Promise<{
  content: string | null;
  tool_calls?: ToolCall[];
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
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
        const toolArgs = JSON.parse(tc.function.arguments);
        toolsUsed.push(toolName);

        let toolResult: string;
        try {
          const output = await executeTool(toolName, toolArgs, ctx);
          toolResult = typeof output === "string" ? output : JSON.stringify(output);
        } catch (err) {
          toolResult = JSON.stringify({ error: String(err) });
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

    return { reply, language: ctx.language, toolsUsed };
  }

  // Max rounds exceeded
  const fallback = ctx.language === "he"
    ? "סליחה, נתקלתי בבעיה. אפשר לנסות שוב?"
    : "Sorry, I ran into an issue. Could you try again?";
  ctx.messages.push({ role: "assistant", content: fallback });
  await saveContext(restaurantId, senderId, ctx);

  return { reply: fallback, language: ctx.language, toolsUsed };
}

// ── Reset Conversation ──────────────────────────────

export async function resetConversation(restaurantId: string, senderId: string): Promise<void> {
  await redis.del(contextKey(restaurantId, senderId));
}
