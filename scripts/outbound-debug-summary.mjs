#!/usr/bin/env node
import { sanitizeConnectionError } from "./lib/debug-errors.mjs";

const args = process.argv.slice(2);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_OUTBOUND_DEBUG_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function requestIdFor(name) {
  return `debug-outbound-${name}-${Date.now()}`;
}

function decodeTokenRestaurantId(token) {
  const [, payload] = token.split(".");
  if (!payload) return "";

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    return typeof decoded.restaurantId === "string" ? decoded.restaurantId : "";
  } catch {
    return "";
  }
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item?.[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map());
}

function printCounts(title, counts) {
  console.log(title);
  if (counts.size === 0) {
    console.log("- none");
    return;
  }
  for (const [key, value] of [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log(`- ${key}: ${value}`);
  }
}

async function getJson(url, token, requestId) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return {
      ok: false,
      status: null,
      requestId,
      body: null,
      error: sanitizeConnectionError(error),
    };
  }

  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep text body for non-JSON failures.
  }

  return {
    ok: response.ok,
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? requestId,
    body,
  };
}

function failStep(name, result) {
  console.error(`${name} failed status=${result.status ?? "network"} requestId=${result.requestId}`);
  if (result.error) {
    console.error(`error=${JSON.stringify(result.error)}`);
  } else if (result.body && typeof result.body === "object") {
    console.error(`code=${result.body.code ?? "unknown"} message=${result.body.error ?? result.body.message ?? "unknown"}`);
  }
  console.error(`logs: pnpm debug:logs ${result.requestId} --since "2 hours ago"`);
}

async function resolveRestaurantId(params) {
  if (params.restaurantId) {
    return {
      restaurantId: params.restaurantId,
      restaurantSlug: "",
      restaurantName: "",
      requestId: "",
      source: params.restaurantIdSource,
    };
  }

  if (!params.restaurantSlug) {
    return {
      restaurantId: "",
      restaurantSlug: "",
      restaurantName: "",
      requestId: "",
    };
  }

  const result = await getJson(new URL(`${params.apiUrl}/api/v1/admin/restaurants`), params.token, requestIdFor("restaurants"));
  if (!result.ok) {
    failStep("restaurant lookup", result);
    process.exit(1);
  }

  const restaurants = Array.isArray(result.body) ? result.body : [];
  const match = restaurants.find((restaurant) => restaurant?.slug === params.restaurantSlug);
  if (!match?.id) {
    console.error(`Restaurant slug not found: ${params.restaurantSlug} requestId=${result.requestId}`);
    console.error(`Available slugs: ${restaurants.map((restaurant) => restaurant?.slug).filter(Boolean).join(", ") || "none"}`);
    console.error(`logs: pnpm debug:logs ${result.requestId} --since "2 hours ago"`);
    process.exit(1);
  }

  return {
    restaurantId: match.id,
    restaurantSlug: match.slug ?? params.restaurantSlug,
    restaurantName: match.name ?? "",
    requestId: result.requestId,
    source: "slug",
  };
}

const apiUrl = (readOption("api-url", process.env.OPENSEAT_API_URL ?? "http://127.0.0.1:3001") ?? "").replace(/\/$/, "");
const token = readOption("token", process.env.OPENSEAT_TOKEN ?? "");
const explicitRestaurantId = readOption("restaurant-id", process.env.OPENSEAT_RESTAURANT_ID ?? "");
const restaurantSlug = readOption("restaurant-slug", process.env.OPENSEAT_RESTAURANT_SLUG ?? "");
const tokenRestaurantId = decodeTokenRestaurantId(token);
const status = readOption("status", "");
const messageType = readOption("message-type", "");
const limit = readOption("limit", "25");

if (!token || (!explicitRestaurantId && !restaurantSlug && !tokenRestaurantId)) {
  console.error("Missing OPENSEAT_TOKEN and a restaurant selector.");
  console.error("Usage: OPENSEAT_TOKEN=... OPENSEAT_RESTAURANT_ID=... pnpm debug:outbound");
  console.error("   or: OPENSEAT_TOKEN=... OPENSEAT_RESTAURANT_SLUG=... pnpm debug:outbound");
  console.error("Restaurant admin tokens can also infer the selector from their JWT restaurantId.");
  process.exit(1);
}

const restaurant = await resolveRestaurantId({
  apiUrl,
  token,
  restaurantId: explicitRestaurantId || (restaurantSlug ? "" : tokenRestaurantId),
  restaurantIdSource: explicitRestaurantId ? "env" : "token",
  restaurantSlug,
});
const restaurantId = restaurant.restaurantId;

const outboundUrl = new URL(`${apiUrl}/api/v1/engagement/outbound-messages`);
outboundUrl.searchParams.set("restaurantId", restaurantId);
outboundUrl.searchParams.set("limit", limit);
if (status) outboundUrl.searchParams.set("status", status);
if (messageType) outboundUrl.searchParams.set("messageType", messageType);

const result = await getJson(outboundUrl, token, requestIdFor("messages"));
if (!result.ok) {
  failStep("outbound messages", result);
  process.exit(1);
}

const messages = Array.isArray(result.body?.messages) ? result.body.messages : [];

console.log("Outbound Message Debug Summary");
console.log(`restaurantId=${restaurantId}`);
if (restaurant.source) console.log(`restaurantIdSource=${restaurant.source}`);
if (restaurant.restaurantSlug) console.log(`restaurantSlug=${restaurant.restaurantSlug}`);
if (restaurant.restaurantName) console.log(`restaurantName=${restaurant.restaurantName}`);
if (restaurant.requestId) console.log(`restaurantLookupRequestId=${restaurant.requestId}`);
console.log(`outboundRequestId=${result.requestId}`);
if (status) console.log(`statusFilter=${status}`);
if (messageType) console.log(`messageTypeFilter=${messageType}`);
console.log(`limit=${limit}`);
console.log("");

printCounts("Outbound messages by status:", countBy(messages, "status"));
printCounts("Outbound messages by type:", countBy(messages, "messageType"));
printCounts("Outbound messages by provider:", countBy(messages, "provider"));
console.log("");

if (messages.length === 0) {
  console.log("Recent outbound messages: none");
} else {
  console.log(`Recent outbound messages (${messages.length}):`);
  for (const message of messages) {
    const subject = message.subjectType ? `${message.subjectType}:${message.subjectId ?? "none"}` : "none";
    console.log(
      `- ${message.id} status=${message.status} type=${message.messageType} category=${message.messageCategory} provider=${message.provider} recipient=${message.recipientMasked ?? "none"} subject=${subject}`,
    );
    console.log(`  createdAt=${message.createdAt} preview=${JSON.stringify(message.textPreview ?? "")}`);
  }
}
