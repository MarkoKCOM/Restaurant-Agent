import { Redis } from "ioredis";
import { env } from "../env.js";
import { pingDatabase } from "../db/index.js";

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

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [database, redis] = await Promise.all([
    timedCheck(pingDatabase),
    timedCheck(pingRedis),
  ]);
  const checks = { database, redis };
  const status = Object.values(checks).every((check) => check.status === "ok")
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
  };
}
