import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { redisConnection } from "./index.js";
import { getDailySummary } from "../services/summary.service.js";

export interface SummaryJobData {
  restaurantId: string;
}

async function processSummary(job: Job<SummaryJobData>): Promise<void> {
  const { restaurantId } = job.data;
  const today = new Date().toISOString().slice(0, 10);

  const summary = await getDailySummary(restaurantId, today);

  // TODO: Replace with WhatsApp sender once Baileys integration is ready
  console.log(`DAILY SUMMARY for restaurant ${restaurantId} on ${summary.date}:`);
  console.log(`  Total reservations: ${summary.totalReservations}`);
  console.log(`  Total covers: ${summary.totalCovers}`);
  console.log(`  Completed: ${summary.completedCount}`);
  console.log(`  Cancelled: ${summary.cancelledCount}`);
  console.log(`  No-shows: ${summary.noShowCount}`);
  if (summary.occupancyPeak) {
    console.log(`  Peak slot: ${summary.occupancyPeak.slot} with ${summary.occupancyPeak.covers} covers`);
  }
  if (summary.topGuests.length > 0) {
    console.log(`  Top guests: ${summary.topGuests.map((g) => `${g.name} (${g.visits})`).join(", ")}`);
  }
}

export function createSummaryWorker(): Worker<SummaryJobData> {
  const worker = new Worker<SummaryJobData>("daily-summary", processSummary, {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`Summary job ${job.id} completed for restaurant ${job.data.restaurantId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Summary job ${job?.id} failed:`, err.message);
  });

  return worker;
}
