#!/usr/bin/env node
import "dotenv/config";
import { Queue } from "bullmq";
import { sanitizeConnectionError } from "../../../scripts/lib/debug-errors.mjs";

const DEFAULT_QUEUES = [
  "reservation-reminders",
  "daily-summary",
  "engagement",
  "campaign-delivery",
];

const args = process.argv.slice(2);
const SAMPLE_LIMIT_ENV = "OPENSEAT_QUEUE_DEBUG_SAMPLE_LIMIT";

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_QUEUE_DEBUG_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function parseRedisUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : undefined,
  };
}

function redisLabel(url) {
  try {
    const parsed = new URL(url);
    const db = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.hostname || "localhost"}:${parsed.port || "6379"}${db}`;
  } catch {
    return "invalid-url";
  }
}

function formatTimestamp(value) {
  if (!value) return "none";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Date(numeric).toISOString();
}

function formatRepeatable(job) {
  const schedule = job.pattern ? `pattern=${job.pattern}` : job.every ? `every=${job.every}` : "schedule=unknown";
  const tz = job.tz ? ` tz=${job.tz}` : "";
  const id = job.id ? ` id=${job.id}` : "";
  return `- ${job.name}${id} ${schedule}${tz} next=${formatTimestamp(job.next)} key=${job.key}`;
}

function maskValue(key, value) {
  const normalizedKey = key.toLowerCase();
  if (value === null || value === undefined) return value;
  if (normalizedKey.includes("token") || normalizedKey.includes("secret") || normalizedKey.includes("password")) {
    return "[redacted]";
  }
  if (normalizedKey.includes("phone") || normalizedKey.includes("whatsapp")) {
    const text = String(value).replace(/\s+/g, "");
    return text.length <= 4 ? "****" : `${text.slice(0, 3)}****${text.slice(-2)}`;
  }
  if (normalizedKey.includes("email")) {
    const [name, domain] = String(value).split("@");
    return domain ? `${name.slice(0, 2)}***@${domain}` : "[redacted-email]";
  }
  return value;
}

function sanitizeJobData(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJobData(item));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      item && typeof item === "object" ? sanitizeJobData(item) : maskValue(key, item),
    ]),
  );
}

function formatJob(job) {
  const failedReason = job.failedReason ? ` failedReason=${JSON.stringify(job.failedReason).slice(0, 240)}` : "";
  const attempts = typeof job.attemptsMade === "number" ? ` attempts=${job.attemptsMade}` : "";
  const data = job.data && typeof job.data === "object" ? ` data=${JSON.stringify(sanitizeJobData(job.data)).slice(0, 240)}` : "";
  return `- ${job.name} id=${job.id ?? "none"} timestamp=${formatTimestamp(job.timestamp)}${attempts}${data}${failedReason}`;
}

const redisUrl = readOption("redis-url", process.env.REDIS_URL ?? "redis://localhost:6379");
const queueNames = String(readOption("queues", DEFAULT_QUEUES.join(",")))
  .split(",")
  .map((queue) => queue.trim())
  .filter(Boolean);
const sampleLimit = Math.min(Math.max(Number(readOption("sample-limit", process.env[SAMPLE_LIMIT_ENV] ?? "5")) || 5, 1), 25);
const connection = parseRedisUrl(redisUrl);
const queues = queueNames.map((name) => new Queue(name, { connection }));

console.log("OpenSeat Queue Debug Summary");
console.log(`redis=${redisLabel(redisUrl)}`);
console.log(`queues=${queueNames.join(",")}`);
console.log(`sampleLimit=${sampleLimit}`);

try {
  for (const queue of queues) {
    const [counts, repeatableJobs, failedJobs, delayedJobs] = await Promise.all([
      queue.getJobCounts("waiting", "delayed", "active", "completed", "failed", "paused", "prioritized", "waiting-children"),
      queue.getRepeatableJobs(0, 100),
      queue.getFailed(0, sampleLimit - 1),
      queue.getDelayed(0, sampleLimit - 1),
    ]);

    console.log("");
    console.log(`Queue: ${queue.name}`);
    console.log(`counts=${Object.entries(counts).map(([key, value]) => `${key}:${value}`).join(",")}`);

    console.log("repeatable:");
    if (repeatableJobs.length === 0) {
      console.log("- none");
    } else {
      for (const job of repeatableJobs) {
        console.log(formatRepeatable(job));
      }
    }

    console.log("failed samples:");
    if (failedJobs.length === 0) {
      console.log("- none");
    } else {
      for (const job of failedJobs) {
        console.log(formatJob(job));
      }
    }

    console.log("delayed samples:");
    if (delayedJobs.length === 0) {
      console.log("- none");
    } else {
      for (const job of delayedJobs) {
        console.log(formatJob(job));
      }
    }
  }
} catch (error) {
  console.error("Queue debug summary failed.");
  console.error(JSON.stringify(sanitizeConnectionError(error), null, 2));
  process.exitCode = 1;
} finally {
  await Promise.all(queues.map((queue) => queue.close()));
}
