import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { eq } from "drizzle-orm";
import { redisConnection } from "./index.js";
import { db } from "../db/index.js";
import { engagementJobs, guests, restaurants } from "../db/schema.js";
import { checkAnniversaries, checkBirthdays, checkWinBack, shouldSendEngagementJob } from "../services/engagement.service.js";
import { checkBirthdayWeekChallenges } from "../services/challenge.service.js";
import { recordOutboundDelivery } from "../services/outbound-message.service.js";

export interface EngagementJobData {
  jobId?: string;
  type: string;
  guestId?: string;
  restaurantId: string;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

function engagementMessagePreview(params: {
  type: string;
  guestName: string;
  restaurantName: string;
  pointsBalance: number;
}): string {
  switch (params.type) {
    case "thank_you":
      return `Hi ${params.guestName}, thank you for visiting ${params.restaurantName}. We hope to see you again soon.`;
    case "review_request":
      return `Hi ${params.guestName}, thanks for visiting ${params.restaurantName}. If you enjoyed it, would you leave us a review?`;
    case "birthday":
      return `Happy birthday ${params.guestName}! ${params.restaurantName} has a birthday treat waiting for you.`;
    case "anniversary":
      return `${params.guestName}, it has been a year since your first visit. ${params.restaurantName} would love to host you again.`;
    case "win_back_30":
    case "win_back_60":
    case "win_back_90":
      return `${params.guestName}, we miss you at ${params.restaurantName}. Your current club balance is ${params.pointsBalance} points.`;
    case "lucky_spin_reward":
      return `${params.guestName}, you won a surprise reward at ${params.restaurantName}.`;
    case "challenge_completion":
      return `${params.guestName}, you completed a club challenge at ${params.restaurantName}.`;
    case "leaderboard_summary":
      return `${params.guestName}, your leaderboard summary from ${params.restaurantName} is ready.`;
    case "streak_broken":
      return `${params.guestName}, your visit streak paused. Come back to ${params.restaurantName} to restart it.`;
    default:
      return `${params.restaurantName} has an update for ${params.guestName}.`;
  }
}

async function processEngagement(job: Job<EngagementJobData>, logger: FastifyBaseLogger): Promise<void> {
  const { jobId, type, guestId, restaurantId } = job.data;

  // Handle win-back cron job (no specific guest, triggers checkWinBack)
  if (type === "win_back_cron") {
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type },
      "Running daily win-back check",
    );
    const result = await checkWinBack(restaurantId);
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type, ...result },
      "Win-back check complete",
    );
    return;
  }

  if (type === "birthday_cron") {
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type },
      "Running daily birthday check",
    );
    const result = await checkBirthdays(restaurantId);
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type, ...result },
      "Birthday check complete",
    );
    return;
  }

  if (type === "anniversary_cron") {
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type },
      "Running daily anniversary check",
    );
    const result = await checkAnniversaries(restaurantId);
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type, ...result },
      "Anniversary check complete",
    );
    return;
  }

  if (type === "birthday_week_challenge_cron") {
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type },
      "Running daily birthday-week challenge check",
    );
    const result = await checkBirthdayWeekChallenges(restaurantId);
    logger.info(
      { queue: "engagement", jobId: job.id, restaurantId, engagementType: type, ...result },
      "Birthday-week challenge check complete",
    );
    return;
  }

  if (!jobId || !guestId) {
    logger.error(
      { queue: "engagement", bullJobId: job.id, restaurantId, engagementType: type, hasJobId: Boolean(jobId), hasGuestId: Boolean(guestId) },
      "Engagement job missing jobId or guestId",
    );
    return;
  }

  const [engagementJob] = await db
    .select()
    .from(engagementJobs)
    .where(eq(engagementJobs.id, jobId))
    .limit(1);

  if (!engagementJob) {
    logger.error(
      { queue: "engagement", bullJobId: job.id, engagementJobId: jobId, restaurantId, guestId, engagementType: type },
      "Engagement job DB row not found",
    );
    return;
  }

  const sendDecision = await shouldSendEngagementJob(engagementJob);
  if (!sendDecision.allowed) {
    logger.info(
      { queue: "engagement", bullJobId: job.id, engagementJobId: jobId, restaurantId, guestId, engagementType: type, skipReason: sendDecision.reason },
      "Engagement job skipped by policy",
    );
    await db
      .update(engagementJobs)
      .set({
        status: "skipped",
        skipReason: sendDecision.reason,
      })
      .where(eq(engagementJobs.id, jobId));
    return;
  }

  // Fetch guest and restaurant info
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!guest || !restaurant) {
    logger.error(
      { queue: "engagement", bullJobId: job.id, engagementJobId: jobId, restaurantId, guestId, engagementType: type, guestFound: Boolean(guest), restaurantFound: Boolean(restaurant) },
      "Engagement job guest or restaurant not found",
    );
    await db
      .update(engagementJobs)
      .set({ status: "failed", skipReason: "guest_or_restaurant_not_found" })
      .where(eq(engagementJobs.id, jobId));
    return;
  }

  const messageText = engagementMessagePreview({
    type,
    guestName: guest.name,
    restaurantName: restaurant.name,
    pointsBalance: guest.pointsBalance,
  });
  const outbound = await recordOutboundDelivery({
    restaurantId,
    guestId,
    recipient: guest.phone,
    messageType: type,
    messageCategory: engagementJob.messageCategory as "transactional" | "promotional",
    subjectType: "engagement_job",
    subjectId: jobId,
    text: messageText,
    payload: {
      queue: "engagement",
      bullJobId: job.id,
      engagementJobId: jobId,
      engagementType: type,
      pointsBalance: guest.pointsBalance,
    },
  });

  // TODO: Replace with WhatsApp sender once provider integration is ready.
  logger.info(
    {
      queue: "engagement",
      bullJobId: job.id,
      outboundMessageId: outbound.id,
      engagementJobId: jobId,
      restaurantId,
      restaurantName: restaurant.name,
      guestId,
      guestPhoneMasked: maskPhone(guest.phone),
      engagementType: type,
      pointsBalance: guest.pointsBalance,
    },
    "Engagement message ready to send",
  );

  if (outbound.status === "skipped") {
    await db
      .update(engagementJobs)
      .set({
        status: "skipped",
        skipReason: outbound.errorCode ?? "outbound_delivery_skipped",
      })
      .where(eq(engagementJobs.id, jobId));
    return;
  }

  // Mark job as sent
  await db
    .update(engagementJobs)
    .set({
      status: "sent",
      sentAt: new Date(),
    })
    .where(eq(engagementJobs.id, jobId));
}

export function createEngagementWorker(logger: FastifyBaseLogger): Worker<EngagementJobData> {
  const worker = new Worker<EngagementJobData>("engagement", (job) => processEngagement(job, logger), {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info(
      { queue: "engagement", bullJobId: job.id, engagementJobId: job.data.jobId, restaurantId: job.data.restaurantId, engagementType: job.data.type },
      "Engagement job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, queue: "engagement", bullJobId: job?.id, engagementJobId: job?.data.jobId, restaurantId: job?.data.restaurantId, engagementType: job?.data.type },
      "Engagement job failed",
    );
    // Mark as failed in DB
    if (job?.data?.jobId) {
      db.update(engagementJobs)
        .set({ status: "failed" })
        .where(eq(engagementJobs.id, job.data.jobId))
        .catch(() => {});
    }
  });

  return worker;
}
