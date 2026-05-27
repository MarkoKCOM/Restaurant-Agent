#!/usr/bin/env node
import { sanitizeConnectionError } from "./lib/debug-errors.mjs";

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

const apiUrl = (readOption("api-url", process.env.OPENSEAT_API_URL ?? "http://127.0.0.1:3001") ?? "").replace(/\/$/, "");
const token = readOption("token", process.env.OPENSEAT_TOKEN ?? "");
const restaurantId = readOption("restaurant-id", process.env.OPENSEAT_RESTAURANT_ID ?? "");
const failureStatus = readOption("failure-status", "open");
const failureLimit = readOption("failure-limit", "20");
const engagementStatus = readOption("engagement-status", "");
const messageCategory = readOption("message-category", "");

if (!token || !restaurantId) {
  console.error("Missing OPENSEAT_TOKEN or OPENSEAT_RESTAURANT_ID.");
  console.error("Usage: OPENSEAT_TOKEN=... OPENSEAT_RESTAURANT_ID=... pnpm debug:membership");
  process.exit(1);
}

const failuresUrl = new URL(`${apiUrl}/api/v1/loyalty/processing-failures`);
failuresUrl.searchParams.set("restaurantId", restaurantId);
failuresUrl.searchParams.set("status", failureStatus);
failuresUrl.searchParams.set("limit", failureLimit);

const engagementUrl = new URL(`${apiUrl}/api/v1/engagement/jobs`);
engagementUrl.searchParams.set("restaurantId", restaurantId);
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

const skipped = jobs.filter((job) => job.status === "skipped" && job.skipReason);
if (skipped.length > 0) {
  console.log("Recent skipped engagement reasons:");
  for (const job of skipped.slice(0, 10)) {
    console.log(`- ${job.type} guest=${job.guestId} reason=${job.skipReason}`);
  }
}
