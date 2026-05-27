import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { redisConnection } from "./index.js";
import {
  formatMorningSummaryMessage,
  getDailySummary,
  getMorningSummary,
} from "../services/summary.service.js";

export interface SummaryJobData {
  restaurantId: string;
  type?: "closing" | "morning";
}

async function processSummary(job: Job<SummaryJobData>, logger: FastifyBaseLogger): Promise<void> {
  const { restaurantId, type = "closing" } = job.data;

  if (type === "morning") {
    const summary = await getMorningSummary({ restaurantId });
    const message = formatMorningSummaryMessage(summary);

    // TODO: Replace log delivery with the WhatsApp sender once Baileys integration is ready.
    logger.info(
      {
        queue: "daily-summary",
        jobId: job.id,
        type,
        restaurantId,
        date: summary.summaryDate,
        yesterdayDate: summary.yesterdayDate,
        yesterdayCovers: summary.yesterday.totalCovers,
        todayBookings: summary.today.totalReservations,
        todayCovers: summary.today.totalCovers,
        notableGuestCount: summary.notableGuests.length,
        alertCount: summary.alerts.length,
        ownerWhatsappConfigured: summary.ownerWhatsappConfigured,
        messagePreview: message.slice(0, 500),
      },
      "Daily morning summary ready to send",
    );
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const summary = await getDailySummary(restaurantId, today);

  // TODO: Replace with WhatsApp sender once Baileys integration is ready
  logger.info(
    {
      queue: "daily-summary",
      jobId: job.id,
      type,
      restaurantId,
      date: summary.date,
      totalReservations: summary.totalReservations,
      totalCovers: summary.totalCovers,
      completedCount: summary.completedCount,
      cancelledCount: summary.cancelledCount,
      noShowCount: summary.noShowCount,
      occupancyPeak: summary.occupancyPeak,
      topGuestCount: summary.topGuests.length,
    },
    "Daily summary ready to send",
  );
}

export function createSummaryWorker(logger: FastifyBaseLogger): Worker<SummaryJobData> {
  const worker = new Worker<SummaryJobData>("daily-summary", (job) => processSummary(job, logger), {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.info(
      { queue: "daily-summary", jobId: job.id, restaurantId: job.data.restaurantId, type: job.data.type ?? "closing" },
      "Summary job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, queue: "daily-summary", jobId: job?.id, restaurantId: job?.data.restaurantId, type: job?.data.type ?? "closing" },
      "Summary job failed",
    );
  });

  return worker;
}
