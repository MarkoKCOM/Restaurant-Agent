#!/usr/bin/env node
import { sanitizeConnectionError } from "./lib/debug-errors.mjs";

const positionalArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const targetUrl = positionalArgs[0] ?? `${process.env.OPENSEAT_API_URL ?? "http://localhost:3001"}/api/v1/health`;
const method = process.env.METHOD ?? "GET";
const token = process.env.OPENSEAT_TOKEN;
const restaurantId = process.env.OPENSEAT_RESTAURANT_ID;
const body = process.env.BODY;
const requestId = process.env.REQUEST_ID ?? `debug-${Date.now()}`;
const expectedStatus = process.env.EXPECT_STATUS ? Number(process.env.EXPECT_STATUS) : undefined;
const expectedCode = process.env.EXPECT_CODE;
const expectedRequestId = process.env.EXPECT_REQUEST_ID ?? process.env.REQUEST_ID;

const headers = {
  "x-request-id": requestId,
};

if (token) {
  headers.authorization = `Bearer ${token}`;
}

if (restaurantId) {
  headers["x-restaurant-id"] = restaurantId;
}

if (body) {
  headers["content-type"] = "application/json";
}

const startedAt = Date.now();
let response;
try {
  response = await fetch(targetUrl, {
    method,
    headers,
    body,
  });
} catch (error) {
  const elapsedMs = Date.now() - startedAt;
  console.log(JSON.stringify({
    url: targetUrl,
    method,
    status: null,
    ok: false,
    elapsedMs,
    requestId,
    contentType: "",
    error: sanitizeConnectionError(error),
  }, null, 2));
  process.exitCode = 1;
  process.exit();
}
const elapsedMs = Date.now() - startedAt;
const text = await response.text();
const contentType = response.headers.get("content-type") ?? "";

let parsedBody = text;
if (contentType.includes("application/json")) {
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = text;
  }
}

console.log(JSON.stringify({
  url: targetUrl,
  method,
  status: response.status,
  ok: response.ok,
  elapsedMs,
  requestId: response.headers.get("x-request-id") ?? requestId,
  contentType,
  body: parsedBody,
}, null, 2));

const responseRequestId = response.headers.get("x-request-id") ?? requestId;
const bodyCode = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
  ? parsedBody.code
  : undefined;
const bodyRequestId = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
  ? parsedBody.requestId
  : undefined;

if (expectedStatus !== undefined && response.status !== expectedStatus) {
  console.error(`Expected status ${expectedStatus}, got ${response.status}`);
  process.exitCode = 1;
}

if (expectedCode !== undefined && bodyCode !== expectedCode) {
  console.error(`Expected code ${expectedCode}, got ${String(bodyCode)}`);
  process.exitCode = 1;
}

if (expectedRequestId !== undefined) {
  if (responseRequestId !== expectedRequestId) {
    console.error(`Expected x-request-id ${expectedRequestId}, got ${responseRequestId}`);
    process.exitCode = 1;
  }
  if (bodyRequestId !== undefined && bodyRequestId !== expectedRequestId) {
    console.error(`Expected body requestId ${expectedRequestId}, got ${String(bodyRequestId)}`);
    process.exitCode = 1;
  }
}

if (!response.ok && expectedStatus === undefined) {
  process.exitCode = 1;
}
