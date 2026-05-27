import { Redis } from "ioredis";
import type { Queue } from "bullmq";
import { env } from "../env.js";
import { pingDatabase } from "../db/index.js";
import { engagementQueue, reminderQueue, summaryQueue } from "../queue/index.js";

export type DiagnosticStatus = "ok" | "error";

export interface DiagnosticCheck {
  status: DiagnosticStatus;
  latencyMs: number;
  error?: {
    name: string;
    code?: string;
    message: string;
  };
}

export interface DiagnosticsReport {
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  environment: {
    nodeEnv: string;
    logLevel: string;
    apiHost: string;
    apiPort: number;
    agentModel: string;
    chatModel: string;
    openRouterConfigured: boolean;
  };
  checks: {
    database: DiagnosticCheck;
    redis: DiagnosticCheck;
  };
  queues: QueueDiagnostic[];
}

export interface QueueDiagnostic {
  name: string;
  status: DiagnosticStatus;
  latencyMs: number;
  counts?: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
  failedSamples?: Array<{
    id: string | number | null;
    name: string;
    attemptsMade: number;
    failedReason?: string;
    timestamp?: number;
    finishedOn?: number;
  }>;
  error?: DiagnosticCheck["error"];
}

function sanitizeError(error: unknown): DiagnosticCheck["error"] {
  if (error instanceof Error) {
    const maybeCoded = error as Error & { code?: string };
    return {
      name: error.name,
      code: maybeCoded.code,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

async function timedCheck(fn: () => Promise<void>): Promise<DiagnosticCheck> {
  const startedAt = Date.now();

  try {
    await fn();
    return {
      status: "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
    };
  }
}

async function pingRedis(): Promise<void> {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1_000,
    commandTimeout: 1_000,
  });

  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

async function inspectQueue(name: string, queue: Queue): Promise<QueueDiagnostic> {
  const startedAt = Date.now();

  try {
    const [counts, failedJobs] = await Promise.all([
      queue.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused"),
      queue.getFailed(0, 2),
    ]);

    return {
      name,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        paused: counts.paused ?? 0,
      },
      failedSamples: failedJobs.map((job) => ({
        id: job.id ?? null,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
      })),
    };
  } catch (error: unknown) {
    return {
      name,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
    };
  }
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [database, redis, ...queues] = await Promise.all([
    timedCheck(pingDatabase),
    timedCheck(pingRedis),
    inspectQueue("reservation-reminders", reminderQueue),
    inspectQueue("daily-summary", summaryQueue),
    inspectQueue("engagement", engagementQueue),
  ]);
  const checks = { database, redis };
  const status = Object.values(checks).every((check) => check.status === "ok")
    && queues.every((queue) => queue.status === "ok")
    ? "ok"
    : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: {
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      apiHost: env.API_HOST,
      apiPort: env.API_PORT,
      agentModel: env.AGENT_MODEL,
      chatModel: env.CHAT_MODEL,
      openRouterConfigured: Boolean(env.OPENROUTER_API_KEY),
    },
    checks,
    queues,
  };
}
