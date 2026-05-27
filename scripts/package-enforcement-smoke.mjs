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

  return process.env[`OPENSEAT_PACKAGE_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function requestIdFor(name) {
  return `debug-package-${name}-${Date.now()}`;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function request(path, { method = "GET", body, token, requestId } = {}) {
  const startedAt = Date.now();
  const headers = { "x-request-id": requestId };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const parsed = parseJson(text);
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      requestId,
      returnedRequestId: response.headers.get("x-request-id") ?? parsed?.requestId ?? null,
      body: parsed,
      bodyPreview: text.slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      elapsedMs: Date.now() - startedAt,
      requestId,
      error: sanitizeConnectionError(error),
    };
  }
}

function summarizeBody(body) {
  if (!body || typeof body !== "object") return {};
  return {
    code: body.code ?? null,
    restaurantPackage: body.restaurantPackage ?? null,
    requiredPackage: body.requiredPackage ?? null,
    previewMatched: body.preview?.matchedCount ?? null,
    hasRetention: Boolean(body.retention),
    jobCount: Array.isArray(body.jobs) ? body.jobs.length : null,
    rewardCount: Array.isArray(body.rewards) ? body.rewards.length : null,
    challengeCount: Array.isArray(body.challenges) ? body.challenges.length : null,
  };
}

function assertProbe(probe) {
  if (probe.expectStatus && probe.result.status !== probe.expectStatus) {
    throw new Error(`${probe.name} expected HTTP ${probe.expectStatus}, got ${probe.result.status}`);
  }
  if (probe.expectCode && probe.result.body?.code !== probe.expectCode) {
    throw new Error(`${probe.name} expected code ${probe.expectCode}, got ${probe.result.body?.code ?? "none"}`);
  }
  if (probe.expectOk && !probe.result.ok) {
    throw new Error(`${probe.name} expected a successful response, got HTTP ${probe.result.status}`);
  }
}

const apiUrl = (process.env.OPENSEAT_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const token = process.env.OPENSEAT_TOKEN || createSignedSuperAdminToken();

if (!token) {
  console.error("Missing OPENSEAT_TOKEN or JWT_SECRET for a super-admin package smoke token.");
  process.exit(1);
}

const restaurantsResult = await request("/api/v1/admin/restaurants", {
  token,
  requestId: requestIdFor("restaurants"),
});

if (!restaurantsResult.ok) {
  console.error("Package Enforcement Smoke");
  console.error(`restaurants status=${restaurantsResult.status} requestId=${restaurantsResult.requestId}`);
  console.error(JSON.stringify(restaurantsResult.body ?? restaurantsResult.error ?? restaurantsResult.bodyPreview, null, 2));
  process.exit(1);
}

const restaurants = Array.isArray(restaurantsResult.body) ? restaurantsResult.body : [];
const configuredStarterId = readOption("starter-restaurant-id", "");
const configuredGrowthId = readOption("growth-restaurant-id", "");
const starterRestaurant = configuredStarterId
  ? restaurants.find((restaurant) => restaurant.id === configuredStarterId)
  : restaurants.find((restaurant) => restaurant.package === "starter");
const growthRestaurant = configuredGrowthId
  ? restaurants.find((restaurant) => restaurant.id === configuredGrowthId)
  : restaurants.find((restaurant) => restaurant.package === "growth");

console.log("Package Enforcement Smoke");
console.log(`apiUrl=${apiUrl}`);
console.log(`restaurantsRequestId=${restaurantsResult.requestId}`);
console.log(`restaurants=${restaurants.length}`);

if (!starterRestaurant || !growthRestaurant) {
  console.log(`skipped=true starter=${starterRestaurant?.id ?? "none"} growth=${growthRestaurant?.id ?? "none"}`);
  console.log("reason=Need at least one starter and one growth restaurant to compare package enforcement.");
  process.exit(0);
}

console.log(`starterRestaurant=${starterRestaurant.id} slug=${starterRestaurant.slug ?? "none"}`);
console.log(`growthRestaurant=${growthRestaurant.id} slug=${growthRestaurant.slug ?? "none"}`);

const surfaces = [
  {
    surface: "campaigns",
    method: "POST",
    path: () => "/api/v1/campaigns/audience-preview",
    body: (restaurantId) => ({ restaurantId, filter: {}, sampleLimit: 1 }),
  },
  {
    surface: "analytics",
    path: (restaurantId) => `/api/v1/analytics/retention?restaurantId=${restaurantId}`,
  },
  {
    surface: "engagement",
    path: (restaurantId) => `/api/v1/engagement/jobs?restaurantId=${restaurantId}&limit=1`,
  },
  {
    surface: "loyalty",
    path: (restaurantId) => `/api/v1/loyalty/rewards?restaurantId=${restaurantId}`,
  },
  {
    surface: "gamification",
    path: (restaurantId) => `/api/v1/gamification/challenges?restaurantId=${restaurantId}`,
  },
];

const probes = [];
for (const surface of surfaces) {
  for (const [packageName, restaurant, expectation] of [
    ["starter", starterRestaurant, { expectStatus: 403, expectCode: "PACKAGE_GROWTH_REQUIRED" }],
    ["growth", growthRestaurant, { expectOk: true }],
  ]) {
    const name = `${surface.surface}.${packageName}`;
    const result = await request(surface.path(restaurant.id), {
      method: surface.method ?? "GET",
      body: surface.body?.(restaurant.id),
      token,
      requestId: requestIdFor(name),
    });
    probes.push({ name, surface: surface.surface, packageName, restaurantId: restaurant.id, result, ...expectation });
  }
}

let failed = false;
for (const probe of probes) {
  try {
    assertProbe(probe);
  } catch (error) {
    failed = true;
    probe.failure = error instanceof Error ? error.message : String(error);
  }

  const summary = summarizeBody(probe.result.body);
  console.log(
    [
      `- ${probe.name}`,
      `status=${probe.result.status ?? "none"}`,
      `ok=${probe.result.ok ? "yes" : "no"}`,
      `requestId=${probe.result.requestId}`,
      `returnedRequestId=${probe.result.returnedRequestId ?? "none"}`,
      `code=${summary.code ?? "none"}`,
      `restaurantPackage=${summary.restaurantPackage ?? "none"}`,
      `requiredPackage=${summary.requiredPackage ?? "none"}`,
      `counts=preview:${summary.previewMatched ?? "n/a"},jobs:${summary.jobCount ?? "n/a"},rewards:${summary.rewardCount ?? "n/a"},challenges:${summary.challengeCount ?? "n/a"}`,
      probe.failure ? `failure=${probe.failure}` : "pass=yes",
    ].join(" "),
  );
}

if (failed) {
  console.error("Package enforcement smoke failed.");
  process.exit(1);
}

console.log("Package enforcement smoke passed.");
