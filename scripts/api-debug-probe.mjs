#!/usr/bin/env node

const positionalArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const targetUrl = positionalArgs[0] ?? `${process.env.OPENSEAT_API_URL ?? "http://localhost:3001"}/api/v1/health`;
const method = process.env.METHOD ?? "GET";
const token = process.env.OPENSEAT_TOKEN;
const body = process.env.BODY;
const requestId = process.env.REQUEST_ID ?? `debug-${Date.now()}`;

const headers = {
  "x-request-id": requestId,
};

if (token) {
  headers.authorization = `Bearer ${token}`;
}

if (body) {
  headers["content-type"] = "application/json";
}

const startedAt = Date.now();
const response = await fetch(targetUrl, {
  method,
  headers,
  body,
});
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

if (!response.ok) {
  process.exitCode = 1;
}
