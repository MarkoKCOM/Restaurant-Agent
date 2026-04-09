import { Queue } from "bullmq";
import type { ConnectionOptions, DefaultJobOptions } from "bullmq";
import { env } from "../env.js";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
}

export const redisConnection: ConnectionOptions = parseRedisUrl(env.REDIS_URL);

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export const reminderQueue = new Queue("reservation-reminders", {
  connection: redisConnection,
  defaultJobOptions,
});

export const summaryQueue = new Queue("daily-summary", {
  connection: redisConnection,
  defaultJobOptions,
});

export const engagementQueue = new Queue("engagement", {
  connection: redisConnection,
  defaultJobOptions,
});
