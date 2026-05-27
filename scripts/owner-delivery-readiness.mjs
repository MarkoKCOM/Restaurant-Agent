#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { sanitizeConnectionError } from "./lib/debug-errors.mjs";
import { createSignedSuperAdminToken } from "./lib/debug-token.mjs";

const args = process.argv.slice(2);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_OWNER_DELIVERY_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function requestIdFor(name) {
  return `debug-owner-delivery-${name}-${Date.now()}`;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function getJson(url, token, requestId) {
  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-request-id": requestId,
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? requestId,
      body: parseJson(text),
      bodyPreview: text.slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      requestId,
      error: sanitizeConnectionError(error),
    };
  }
}

function failStep(name, result) {
  console.error(`${name} failed status=${result.status ?? "network"} requestId=${result.requestId}`);
  if (result.error) {
    console.error(`error=${JSON.stringify(result.error)}`);
  } else if (result.body && typeof result.body === "object") {
    console.error(`code=${result.body.code ?? "unknown"} message=${result.body.error ?? result.body.message ?? "unknown"}`);
  } else if (result.bodyPreview) {
    console.error(`body=${JSON.stringify(result.bodyPreview)}`);
  }
  console.error(`logs: pnpm debug:logs ${result.requestId} --since "2 hours ago"`);
}

const apiUrl = (readOption("api-url", process.env.OPENSEAT_API_URL ?? "http://127.0.0.1:3001") ?? "").replace(/\/$/, "");
const explicitToken = readOption("token", process.env.OPENSEAT_TOKEN ?? "");
const token = explicitToken || createSignedSuperAdminToken();
const packageFilter = readOption("package", "");
const onlyMissing = readOption("only-missing", "true") !== "false";
const artifactPath = readOption("artifact-path", process.env.OPENSEAT_OWNER_DELIVERY_ARTIFACT_PATH ?? "");

if (!token) {
  console.error("Missing OPENSEAT_TOKEN or JWT_SECRET for a super-admin owner delivery readiness token.");
  process.exit(1);
}

const restaurantsResult = await getJson(new URL(`${apiUrl}/api/v1/admin/restaurants`), token, requestIdFor("restaurants"));
if (!restaurantsResult.ok) {
  failStep("restaurant readiness lookup", restaurantsResult);
  process.exit(1);
}

let restaurants = Array.isArray(restaurantsResult.body) ? restaurantsResult.body : [];
if (packageFilter) {
  restaurants = restaurants.filter((restaurant) => restaurant?.package === packageFilter);
}

const missing = restaurants.filter((restaurant) => restaurant?.ownerWhatsappConfigured !== true);
const configured = restaurants.filter((restaurant) => restaurant?.ownerWhatsappConfigured === true);
const hasOwnerDeliveryRecipient = (restaurant) =>
  restaurant?.ownerWhatsappConfigured === true
  || Boolean(restaurant?.ownerPhoneMasked || restaurant?.whatsappNumberMasked || restaurant?.phoneMasked);
const recipientConfigured = restaurants.filter((restaurant) => hasOwnerDeliveryRecipient(restaurant));
const recipientMissing = restaurants.filter((restaurant) => !hasOwnerDeliveryRecipient(restaurant));
const fallbackAvailable = missing.filter((restaurant) => hasOwnerDeliveryRecipient(restaurant));
const rows = onlyMissing ? missing : restaurants;
const repairCommandFor = (restaurant) =>
  `METHOD=PATCH BODY='{"ownerWhatsapp":"<owner-whatsapp-number>"}' OPENSEAT_TOKEN=... pnpm debug:api -- ${apiUrl}/api/v1/restaurants/${restaurant.id}`;
const report = {
  type: "owner-delivery-readiness",
  status: "ok",
  apiUrl,
  requestId: restaurantsResult.requestId,
  tokenSource: explicitToken ? "provided" : "jwt_secret",
  packageFilter: packageFilter || null,
  onlyMissing,
  totals: {
    restaurants: restaurants.length,
    ownerWhatsappConfigured: configured.length,
    ownerWhatsappMissing: missing.length,
    ownerDeliveryRecipientConfigured: recipientConfigured.length,
    ownerDeliveryRecipientMissing: recipientMissing.length,
    ownerDeliveryFallbackAvailable: fallbackAvailable.length,
  },
  missingRestaurants: missing.map((restaurant) => ({
    id: restaurant.id,
    slug: restaurant.slug ?? null,
    name: restaurant.name ?? null,
    package: restaurant.package ?? null,
    ownerWhatsappConfigured: restaurant.ownerWhatsappConfigured === true,
    ownerWhatsappMasked: restaurant.ownerWhatsappMasked ?? null,
    ownerPhoneMasked: restaurant.ownerPhoneMasked ?? null,
    whatsappNumberMasked: restaurant.whatsappNumberMasked ?? null,
    phoneMasked: restaurant.phoneMasked ?? null,
    repairCommand: repairCommandFor(restaurant),
  })),
};

if (artifactPath) {
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log("Owner Delivery Readiness");
console.log(`apiUrl=${apiUrl}`);
console.log(`restaurantsRequestId=${restaurantsResult.requestId}`);
console.log(`tokenSource=${explicitToken ? "provided" : "jwt_secret"}`);
if (packageFilter) console.log(`packageFilter=${packageFilter}`);
console.log(`total=${restaurants.length}`);
console.log(`ownerWhatsappConfigured=${configured.length}`);
console.log(`ownerWhatsappMissing=${missing.length}`);
console.log(`ownerDeliveryRecipientConfigured=${recipientConfigured.length}`);
console.log(`ownerDeliveryRecipientMissing=${recipientMissing.length}`);
console.log(`ownerDeliveryFallbackAvailable=${fallbackAvailable.length}`);
console.log("");

if (rows.length === 0) {
  console.log(onlyMissing ? "Missing owner WhatsApp restaurants: none" : "Restaurants: none");
  process.exit(0);
}

console.log(onlyMissing ? `Missing owner WhatsApp restaurants (${rows.length}):` : `Restaurants (${rows.length}):`);
for (const restaurant of rows) {
  console.log(
    [
      `- ${restaurant.id}`,
      `slug=${restaurant.slug ?? "none"}`,
      `name=${JSON.stringify(restaurant.name ?? "")}`,
      `package=${restaurant.package ?? "unknown"}`,
      `ownerWhatsappConfigured=${restaurant.ownerWhatsappConfigured === true ? "yes" : "no"}`,
      `ownerWhatsapp=${restaurant.ownerWhatsappMasked ?? "none"}`,
      `ownerPhone=${restaurant.ownerPhoneMasked ?? "none"}`,
      `whatsappNumber=${restaurant.whatsappNumberMasked ?? "none"}`,
      `phone=${restaurant.phoneMasked ?? "none"}`,
    ].join(" "),
  );
  if (restaurant.ownerWhatsappConfigured !== true) {
    console.log(`  repair: ${repairCommandFor(restaurant)}`);
  }
}
