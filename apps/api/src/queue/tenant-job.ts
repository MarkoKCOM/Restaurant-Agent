import type { Job } from "bullmq";
import { runWithTenant } from "../context/tenant-context.js";

/**
 * Run a worker job processor inside the tenant context derived from the job's
 * `restaurantId`. Workers run outside any HTTP request, so they establish the
 * context explicitly from job data — mirroring what the auth hook does for
 * requests. The role is `system` (jobs are not acting on behalf of an admin
 * user, but are pinned to a single restaurant, so this is never a bypass).
 */
export function runJobWithTenant<T extends { restaurantId: string }, R>(
  job: Job<T>,
  processor: (job: Job<T>) => Promise<R>,
): Promise<R> {
  return runWithTenant(
    { restaurantId: job.data.restaurantId, role: "system", bypass: false },
    () => processor(job),
  );
}
