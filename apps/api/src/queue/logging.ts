import type { Job } from "bullmq";

export function buildWorkerJobLogContext<T>(job: Job<T> | undefined): {
  bullJobId: string | number | undefined;
  jobName: string | undefined;
  attemptsMade: number | undefined;
  attemptsConfigured: number | undefined;
  timestamp: number | undefined;
  processedOn: number | undefined;
  finishedOn: number | undefined;
} {
  return {
    bullJobId: job?.id,
    jobName: job?.name,
    attemptsMade: job?.attemptsMade,
    attemptsConfigured: typeof job?.opts.attempts === "number" ? job.opts.attempts : undefined,
    timestamp: job?.timestamp,
    processedOn: job?.processedOn,
    finishedOn: job?.finishedOn,
  };
}
