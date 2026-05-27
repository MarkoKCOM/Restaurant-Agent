#!/usr/bin/env node
import { sanitizeConnectionError } from "./lib/debug-errors.mjs";
import { createSignedSuperAdminToken } from "./lib/debug-token.mjs";

const args = process.argv.slice(2);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_MEMBERSHIP_DEBUG_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function requestIdFor(name) {
  return `debug-membership-${name}-${Date.now()}`;
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

function formatDate(value) {
  if (!value) return "none";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function minutesPast(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 60_000);
}

function engagementJobLine(job, now = new Date()) {
  const ageMinutes = minutesPast(job.triggerAt, now);
  const age = ageMinutes === null ? "" : ` ageMinutes=${ageMinutes}`;
  const skipReason = job.skipReason ? ` skipReason=${job.skipReason}` : "";
  const sentAt = job.sentAt ? ` sentAt=${formatDate(job.sentAt)}` : "";
  return `- ${job.id} type=${job.type} status=${job.status} category=${job.messageCategory ?? "unknown"} guest=${job.guestId} triggerAt=${formatDate(job.triggerAt)}${age}${sentAt}${skipReason}`;
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
const explicitToken = readOption("token", process.env.OPENSEAT_TOKEN ?? "");
const token = explicitToken || createSignedSuperAdminToken();
const explicitRestaurantId = readOption("restaurant-id", process.env.OPENSEAT_RESTAURANT_ID ?? "");
const restaurantSlug = readOption("restaurant-slug", process.env.OPENSEAT_RESTAURANT_SLUG ?? "");
const tokenRestaurantId = decodeTokenRestaurantId(token);
const failureStatus = readOption("failure-status", "open");
const failureLimit = readOption("failure-limit", "20");
const engagementLimit = readOption("engagement-limit", "200");
const engagementStatus = readOption("engagement-status", "");
const messageCategory = readOption("message-category", "");

if (!token || (!explicitRestaurantId && !restaurantSlug && !tokenRestaurantId)) {
  console.error("Missing OPENSEAT_TOKEN and a restaurant selector.");
  console.error("Usage: OPENSEAT_TOKEN=... OPENSEAT_RESTAURANT_ID=... pnpm debug:membership");
  console.error("   or: OPENSEAT_TOKEN=... OPENSEAT_RESTAURANT_SLUG=... pnpm debug:membership");
  console.error("If JWT_SECRET is available, the command can synthesize a short-lived super-admin token.");
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

const failuresUrl = new URL(`${apiUrl}/api/v1/loyalty/processing-failures`);
failuresUrl.searchParams.set("restaurantId", restaurantId);
failuresUrl.searchParams.set("status", failureStatus);
failuresUrl.searchParams.set("limit", failureLimit);

const engagementUrl = new URL(`${apiUrl}/api/v1/engagement/jobs`);
engagementUrl.searchParams.set("restaurantId", restaurantId);
engagementUrl.searchParams.set("limit", engagementLimit);
if (engagementStatus) engagementUrl.searchParams.set("status", engagementStatus);
if (messageCategory) engagementUrl.searchParams.set("messageCategory", messageCategory);

const [failuresResult, engagementResult] = await Promise.all([
  getJson(failuresUrl, token, requestIdFor("failures")),
  getJson(engagementUrl, token, requestIdFor("engagement")),
]);

let hasFailure = false;
if (!failuresResult.ok) {
  hasFailure = true;
  failStep("membership processing failures", failuresResult);
}
if (!engagementResult.ok) {
  hasFailure = true;
  failStep("engagement jobs", engagementResult);
}
if (hasFailure) {
  process.exit(1);
}

const failures = Array.isArray(failuresResult.body?.failures) ? failuresResult.body.failures : [];
const jobs = Array.isArray(engagementResult.body?.jobs) ? engagementResult.body.jobs : [];

console.log("Membership Debug Summary");
console.log(`restaurantId=${restaurantId}`);
if (restaurant.source) console.log(`restaurantIdSource=${restaurant.source}`);
console.log(`tokenSource=${explicitToken ? "provided" : "jwt_secret"}`);
if (restaurant.restaurantSlug) console.log(`restaurantSlug=${restaurant.restaurantSlug}`);
if (restaurant.restaurantName) console.log(`restaurantName=${restaurant.restaurantName}`);
if (restaurant.requestId) console.log(`restaurantLookupRequestId=${restaurant.requestId}`);
console.log(`failuresRequestId=${failuresResult.requestId}`);
console.log(`engagementRequestId=${engagementResult.requestId}`);
console.log("");

printCounts("Processing failures by stage:", countBy(failures, "stage"));
printCounts("Processing failures by status:", countBy(failures, "status"));
console.log("");

if (failures.length === 0) {
  console.log("Open processing failures: none");
} else {
  console.log(`Open processing failures (${failures.length}):`);
  for (const failure of failures.slice(0, Number(failureLimit))) {
    console.log(
      `- ${failure.id} stage=${failure.stage} attempts=${failure.attempts} guest=${failure.guestId} reservation=${failure.reservationId ?? "none"} error=${failure.errorCode ?? failure.errorName ?? "unknown"}`,
    );
    console.log(`  retry: METHOD=POST BODY='{"restaurantId":"${restaurantId}"}' OPENSEAT_TOKEN=... pnpm debug:api -- ${apiUrl}/api/v1/loyalty/processing-failures/${failure.id}/retry`);
  }
}
console.log("");

printCounts("Engagement jobs by status:", countBy(jobs, "status"));
printCounts("Engagement jobs by type:", countBy(jobs, "type"));
console.log("");

const now = new Date();
const pendingOverdue = jobs
  .filter((job) => job.status === "pending" && minutesPast(job.triggerAt, now) !== null && minutesPast(job.triggerAt, now) >= 15)
  .sort((a, b) => new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime());
const failedJobs = jobs
  .filter((job) => job.status === "failed")
  .sort((a, b) => new Date(b.updatedAt ?? b.triggerAt).getTime() - new Date(a.updatedAt ?? a.triggerAt).getTime());

console.log(`Overdue pending engagement jobs: ${pendingOverdue.length}`);
if (pendingOverdue.length > 0) {
  for (const job of pendingOverdue.slice(0, 10)) {
    console.log(engagementJobLine(job, now));
  }
  console.log(`logs: pnpm debug:logs ${engagementResult.requestId} --since "2 hours ago"`);
}
console.log("");

console.log(`Failed engagement jobs: ${failedJobs.length}`);
if (failedJobs.length > 0) {
  for (const job of failedJobs.slice(0, 10)) {
    console.log(engagementJobLine(job, now));
  }
  console.log(`logs: pnpm debug:logs ${engagementResult.requestId} --since "2 hours ago"`);
}
console.log("");

const skipped = jobs.filter((job) => job.status === "skipped" && job.skipReason);
if (skipped.length > 0) {
  console.log("Recent skipped engagement reasons:");
  for (const job of skipped.slice(0, 10)) {
    console.log(engagementJobLine(job, now));
  }
}
