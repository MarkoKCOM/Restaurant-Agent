import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { redisConnection } from "./index.js";
import { deliverCampaign } from "../services/campaign.service.js";

export interface CampaignDeliveryJobData {
  campaignId: string;
  restaurantId: string;
}

async function processCampaignDelivery(job: Job<CampaignDeliveryJobData>, logger: FastifyBaseLogger): Promise<void> {
  const { campaignId, restaurantId } = job.data;

  logger.info(
    { queue: "campaign-delivery", bullJobId: job.id, campaignId, restaurantId },
    "Campaign delivery started",
  );

  const result = await deliverCampaign({ campaignId, restaurantId });

  logger.info(
    {
      queue: "campaign-delivery",
      bullJobId: job.id,
      campaignId,
      restaurantId,
      sent: result.delivery.sent,
      skipped: result.delivery.skipped,
      skippedOptedOut: result.delivery.skippedOptedOut,
      skippedRateLimitedWeek: result.delivery.skippedRateLimitedWeek,
      skippedRateLimitedMonth: result.delivery.skippedRateLimitedMonth,
    },
    "Campaign delivery completed",
  );
}

export function createCampaignWorker(logger: FastifyBaseLogger): Worker<CampaignDeliveryJobData> {
  const worker = new Worker<CampaignDeliveryJobData>("campaign-delivery", (job) => processCampaignDelivery(job, logger), {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(
      { queue: "campaign-delivery", bullJobId: job.id, campaignId: job.data.campaignId, restaurantId: job.data.restaurantId },
      "Campaign delivery job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, queue: "campaign-delivery", bullJobId: job?.id, campaignId: job?.data.campaignId, restaurantId: job?.data.restaurantId },
      "Campaign delivery job failed",
    );
  });

  return worker;
}
