import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Redis } from "ioredis";
import type { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { env } from "../env.js";
import { db, pingDatabase } from "../db/index.js";
import { engagementQueue, reminderQueue, summaryQueue } from "../queue/index.js";
import { membershipProcessingFailures } from "../db/schema.js";

const execFileAsync = promisify(execFile);

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
  operational: {
    membershipProcessing: MembershipProcessingDiagnostic;
  };
}

export interface DeploymentDiagnostic {
  nodeVersion: string;
  pid: number;
  cwd: string;
  source: {
    status: DiagnosticStatus;
    commit?: string;
    shortCommit?: string;
    branch?: string;
    dirty?: boolean;
    builtAt?: string;
    checkout?: {
      status: DiagnosticStatus;
      commit?: string;
      shortCommit?: string;
      branch?: string;
      dirty?: boolean;
      error?: DiagnosticCheck["error"];
    };
    checkoutMatchesBuild?: boolean;
    error?: DiagnosticCheck["error"];
  };
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

export interface MembershipProcessingDiagnostic {
  status: "ok" | "attention" | "error";
  openCount?: number;
  totalOpenAttempts?: number;
  latestOpenAttemptAt?: string;
  byStage?: Array<{
    stage: string;
    openCount: number;
    maxAttempts: number;
    latestOpenAttemptAt?: string;
  }>;
  openSamples?: Array<{
    id: string;
    restaurantId: string;
    guestId: string;
    reservationId: string | null;
    stage: string;
    attempts: number;
    errorName: string | null;
    errorCode: string | null;
    errorMessage: string;
    lastAttemptAt: string;
    createdAt: string;
  }>;
  error?: DiagnosticCheck["error"];
}

interface BuildInfo {
  commit?: string;
  shortCommit?: string;
  branch?: string;
  dirty?: boolean;
  builtAt?: string;
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

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function inspectMembershipProcessing(): Promise<MembershipProcessingDiagnostic> {
  try {
    const [summaryRows, stageRows, sampleRows] = await Promise.all([
      db.execute(sql`
        select
          count(*)::int as open_count,
          coalesce(sum(attempts), 0)::int as total_open_attempts,
          max(last_attempt_at) as latest_open_attempt_at
        from ${membershipProcessingFailures}
        where status = 'open'
      `) as Promise<Array<{
        open_count: number;
        total_open_attempts: number;
        latest_open_attempt_at: Date | string | null;
      }>>,
      db.execute(sql`
        select
          stage,
          count(*)::int as open_count,
          max(attempts)::int as max_attempts,
          max(last_attempt_at) as latest_open_attempt_at
        from ${membershipProcessingFailures}
        where status = 'open'
        group by stage
        order by open_count desc, stage asc
      `) as Promise<Array<{
        stage: string;
        open_count: number;
        max_attempts: number;
        latest_open_attempt_at: Date | string | null;
      }>>,
      db
        .select({
          id: membershipProcessingFailures.id,
          restaurantId: membershipProcessingFailures.restaurantId,
          guestId: membershipProcessingFailures.guestId,
          reservationId: membershipProcessingFailures.reservationId,
          stage: membershipProcessingFailures.stage,
          attempts: membershipProcessingFailures.attempts,
          errorName: membershipProcessingFailures.errorName,
          errorCode: membershipProcessingFailures.errorCode,
          errorMessage: membershipProcessingFailures.errorMessage,
          lastAttemptAt: membershipProcessingFailures.lastAttemptAt,
          createdAt: membershipProcessingFailures.createdAt,
        })
        .from(membershipProcessingFailures)
        .where(sql`${membershipProcessingFailures.status} = 'open'`)
        .orderBy(sql`${membershipProcessingFailures.createdAt} desc`)
        .limit(5),
    ]);
    const summary = summaryRows[0];
    const openCount = Number(summary?.open_count ?? 0);

    return {
      status: openCount > 0 ? "attention" : "ok",
      openCount,
      totalOpenAttempts: Number(summary?.total_open_attempts ?? 0),
      latestOpenAttemptAt: toIsoString(summary?.latest_open_attempt_at),
      byStage: stageRows.map((row) => ({
        stage: row.stage,
        openCount: Number(row.open_count),
        maxAttempts: Number(row.max_attempts),
        latestOpenAttemptAt: toIsoString(row.latest_open_attempt_at),
      })),
      openSamples: sampleRows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurantId,
        guestId: row.guestId,
        reservationId: row.reservationId,
        stage: row.stage,
        attempts: row.attempts,
        errorName: row.errorName,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        lastAttemptAt: row.lastAttemptAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    return {
      status: "error",
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

async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 1_000,
    maxBuffer: 64 * 1024,
  });

  return stdout.trim();
}

async function inspectSourceRevision(): Promise<DeploymentDiagnostic["source"]> {
  let buildInfo: BuildInfo;

  try {
    buildInfo = JSON.parse(
      await readFile(new URL("../build-info.json", import.meta.url), "utf8"),
    ) as BuildInfo;
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }

  try {
    const [commit, branch, status] = await Promise.all([
      runGit(["rev-parse", "HEAD"]),
      runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
      runGit(["status", "--porcelain"]),
    ]);
    const checkout = {
      status: "ok" as const,
      commit,
      shortCommit: commit.slice(0, 12),
      branch,
      dirty: status.length > 0,
    };

    return {
      status: "ok",
      commit: buildInfo.commit,
      shortCommit: buildInfo.shortCommit ?? buildInfo.commit?.slice(0, 12),
      branch: buildInfo.branch,
      dirty: buildInfo.dirty,
      builtAt: buildInfo.builtAt,
      checkout,
      checkoutMatchesBuild: Boolean(buildInfo.commit && buildInfo.commit === checkout.commit),
    };
  } catch (error: unknown) {
    return {
      status: "ok",
      commit: buildInfo.commit,
      shortCommit: buildInfo.shortCommit ?? buildInfo.commit?.slice(0, 12),
      branch: buildInfo.branch,
      dirty: buildInfo.dirty,
      builtAt: buildInfo.builtAt,
      checkout: {
        status: "error",
        error: sanitizeError(error),
      },
    };
  }
}

async function inspectDeployment(): Promise<DeploymentDiagnostic> {
  const [source, codeMigrations, databaseMigrations] = await Promise.all([
    inspectSourceRevision(),
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
    source,
    codeMigrations,
    databaseMigrations,
    migrationDrift,
  };
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [database, redis, deployment, membershipProcessing, ...queues] = await Promise.all([
    timedCheck(pingDatabase),
    timedCheck(pingRedis),
    inspectDeployment(),
    inspectMembershipProcessing(),
    inspectQueue("reservation-reminders", reminderQueue),
    inspectQueue("daily-summary", summaryQueue),
    inspectQueue("engagement", engagementQueue),
  ]);
  const checks = { database, redis };
  const status = Object.values(checks).every((check) => check.status === "ok")
    && queues.every((queue) => queue.status === "ok")
    && deployment.source.status === "ok"
    && deployment.codeMigrations.status === "ok"
    && deployment.databaseMigrations.status === "ok"
    && membershipProcessing.status !== "error"
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
    operational: {
      membershipProcessing,
    },
  };
}
