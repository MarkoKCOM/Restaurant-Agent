import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Redis } from "ioredis";
import type { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { env } from "../env.js";
import { db, pingDatabase } from "../db/index.js";
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
  deployment: DeploymentDiagnostic;
  checks: {
    database: DiagnosticCheck;
    redis: DiagnosticCheck;
  };
  queues: QueueDiagnostic[];
}

export interface DeploymentDiagnostic {
  nodeVersion: string;
  pid: number;
  cwd: string;
  codeMigrations: {
    status: DiagnosticStatus;
    count?: number;
    latestFile?: string;
    error?: DiagnosticCheck["error"];
  };
  databaseMigrations: {
    status: DiagnosticStatus;
    count?: number;
    latestId?: number;
    latestHash?: string;
    latestCreatedAt?: number;
    error?: DiagnosticCheck["error"];
  };
  migrationDrift?: {
    status: "ok" | "unknown" | "mismatch";
    codeLatestId?: number;
    databaseLatestId?: number;
    message?: string;
  };
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

function parseMigrationFileId(fileName: string): number | undefined {
  const match = fileName.match(/^(\d+)_.*\.sql$/);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

async function inspectCodeMigrations(): Promise<DeploymentDiagnostic["codeMigrations"]> {
  try {
    const files = (await readdir(join(process.cwd(), "drizzle")))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();

    return {
      status: "ok",
      count: files.length,
      latestFile: files.at(-1),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function inspectDatabaseMigrations(): Promise<DeploymentDiagnostic["databaseMigrations"]> {
  try {
    const rows = await db.execute(sql`
      select
        count(*)::int as count,
        max(id)::int as latest_id,
        (
          select hash
          from drizzle.__drizzle_migrations
          order by id desc
          limit 1
        ) as latest_hash,
        (
          select created_at
          from drizzle.__drizzle_migrations
          order by id desc
          limit 1
        )::bigint as latest_created_at
      from drizzle.__drizzle_migrations
    `) as Array<{
      count: number;
      latest_id: number | null;
      latest_hash: string | null;
      latest_created_at: number | null;
    }>;
    const row = rows[0];

    return {
      status: "ok",
      count: Number(row?.count ?? 0),
      latestId: row?.latest_id ?? undefined,
      latestHash: row?.latest_hash ?? undefined,
      latestCreatedAt: row?.latest_created_at === null || row?.latest_created_at === undefined
        ? undefined
        : Number(row.latest_created_at),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function inspectDeployment(): Promise<DeploymentDiagnostic> {
  const [codeMigrations, databaseMigrations] = await Promise.all([
    inspectCodeMigrations(),
    inspectDatabaseMigrations(),
  ]);
  const codeLatestId = codeMigrations.latestFile
    ? parseMigrationFileId(codeMigrations.latestFile)
    : undefined;
  const databaseLatestId = databaseMigrations.latestId;
  const migrationDrift: DeploymentDiagnostic["migrationDrift"] =
    codeLatestId === undefined || databaseLatestId === undefined
      ? {
          status: "unknown",
          codeLatestId,
          databaseLatestId,
          message: "Migration drift could not be evaluated",
        }
      : codeLatestId === databaseLatestId
        ? { status: "ok", codeLatestId, databaseLatestId }
        : {
            status: "mismatch",
            codeLatestId,
            databaseLatestId,
            message: "Latest code migration does not match latest applied database migration",
          };

  return {
    nodeVersion: process.version,
    pid: process.pid,
    cwd: process.cwd(),
    codeMigrations,
    databaseMigrations,
    migrationDrift,
  };
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [database, redis, deployment, ...queues] = await Promise.all([
    timedCheck(pingDatabase),
    timedCheck(pingRedis),
    inspectDeployment(),
    inspectQueue("reservation-reminders", reminderQueue),
    inspectQueue("daily-summary", summaryQueue),
    inspectQueue("engagement", engagementQueue),
  ]);
  const checks = { database, redis };
  const status = Object.values(checks).every((check) => check.status === "ok")
    && queues.every((queue) => queue.status === "ok")
    && deployment.codeMigrations.status === "ok"
    && deployment.databaseMigrations.status === "ok"
    && deployment.migrationDrift?.status !== "mismatch"
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
    deployment,
    checks,
    queues,
  };
}
