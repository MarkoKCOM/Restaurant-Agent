#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const requestId = args.find((arg) => !arg.startsWith("--"));

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_LOG_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

if (!requestId) {
  console.error("Usage: pnpm debug:logs <request-id> [--since '2 hours ago'] [--service openseat-api] [--context 2]");
  process.exit(1);
}

const service = readOption("service", "openseat-api");
const since = readOption("since", "2 hours ago");
const context = Number(readOption("context", "2"));

function parseJsonFromLine(line) {
  const firstBrace = line.indexOf("{");
  if (firstBrace < 0) return null;

  for (let index = firstBrace; index >= 0 && index < line.length; index = line.indexOf("{", index + 1)) {
    if (index < 0) return null;
    try {
      return JSON.parse(line.slice(index));
    } catch {
      // Keep scanning; short journal output may contain non-JSON prefixes.
    }
  }

  return null;
}

function levelName(level) {
  if (level >= 60) return "fatal";
  if (level >= 50) return "error";
  if (level >= 40) return "warn";
  if (level >= 30) return "info";
  if (level >= 20) return "debug";
  if (level >= 10) return "trace";
  return String(level ?? "unknown");
}

function summarizeEvent(event) {
  const method = event.method ?? event.req?.method;
  const url = event.url ?? event.req?.url;
  const statusCode = event.statusCode ?? event.res?.statusCode;
  const parts = [
    levelName(event.level),
    event.msg,
    method,
    url,
    statusCode ? `status=${statusCode}` : undefined,
    event.code ? `code=${event.code}` : undefined,
    event.userId ? `user=${event.userId}` : undefined,
    event.restaurantId ? `restaurant=${event.restaurantId}` : undefined,
  ].filter(Boolean);

  return parts.join(" ");
}

const journalArgs = [
  "-u",
  service,
  "--since",
  since,
  "--no-pager",
  "-o",
  "short-iso",
];

const child = spawn("journalctl", journalArgs, {
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

child.on("error", (error) => {
  console.error(`Failed to run journalctl: ${error.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`journalctl exited with ${code}`);
    if (stderr.trim()) console.error(stderr.trim());
    process.exit(code ?? 1);
  }

  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const matchIndexes = lines
    .map((line, index) => line.includes(requestId) ? index : -1)
    .filter((index) => index >= 0);

  console.log(JSON.stringify({
    service,
    since,
    requestId,
    totalLines: lines.length,
    matches: matchIndexes.length,
  }, null, 2));

  if (matchIndexes.length === 0) {
    console.error(`No log lines found for requestId=${requestId}`);
    process.exit(1);
  }

  const matchedEvents = matchIndexes
    .map((index) => parseJsonFromLine(lines[index]))
    .filter(Boolean);
  if (matchedEvents.length > 0) {
    console.log("Events:");
    for (const event of matchedEvents) {
      console.log(`- ${summarizeEvent(event)}`);
    }
  }

  const printed = new Set();
  for (const index of matchIndexes) {
    const start = Math.max(0, index - context);
    const end = Math.min(lines.length - 1, index + context);

    for (let current = start; current <= end; current += 1) {
      if (printed.has(current)) continue;
      printed.add(current);
      console.log(lines[current]);
    }
  }
});
