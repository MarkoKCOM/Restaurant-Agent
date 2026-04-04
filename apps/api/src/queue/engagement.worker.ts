import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "./index.js";
import { db } from "../db/index.js";
import { engagementJobs, guests, restaurants } from "../db/schema.js";
import { checkWinBack } from "../services/engagement.service.js";

export interface EngagementJobData {
  jobId?: string;
  type: string;
  guestId?: string;
  restaurantId: string;
}

async function processEngagement(job: Job<EngagementJobData>): Promise<void> {
  const { jobId, type, guestId, restaurantId } = job.data;

  // Handle win-back cron job (no specific guest, triggers checkWinBack)
  if (type === "win_back_cron") {
    console.log(`Running daily win-back check for restaurant ${restaurantId}`);
    const result = await checkWinBack(restaurantId);
    console.log(`Win-back check complete: 30-day=${result.scheduled30}, 60-day=${result.scheduled60}, 90-day=${result.scheduled90}`);
    return;
  }

  if (!jobId || !guestId) {
    console.error("Engagement job missing jobId or guestId");
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
    console.error(`Engagement job ${jobId}: guest or restaurant not found`);
    await db
      .update(engagementJobs)
      .set({ status: "failed" })
      .where(eq(engagementJobs.id, jobId));
    return;
  }

  const phone = guest.phone;
  const name = guest.name;
  const restaurantName = restaurant.name;
  const balance = guest.pointsBalance;

  // Log the appropriate message based on type (WhatsApp sender coming later)
  switch (type) {
    case "thank_you":
      console.log(
        `SEND WhatsApp to ${phone}: Thank you for visiting ${restaurantName}! You earned 10 points. Balance: ${balance + 10}`,
      );
      break;

    case "birthday":
      console.log(
        `SEND WhatsApp to ${phone}: Happy birthday ${name}! 🎂 Here's 100 bonus points on us`,
      );
      break;

    case "review_request":
      console.log(
        `SEND WhatsApp to ${phone}: How was your visit to ${restaurantName}? We'd love your feedback`,
      );
      break;

    case "win_back_30":
      console.log(
        `SEND WhatsApp to ${phone}: We miss you! Here's 20 bonus points`,
      );
      break;

    case "win_back_60":
      console.log(
        `SEND WhatsApp to ${phone}: It's been a while! 50 bonus points waiting for you`,
      );
      break;

    case "win_back_90":
      console.log(
        `SEND WhatsApp to ${phone}: We really miss you! 100 bonus points + free dessert`,
      );
      break;

    default:
      console.log(
        `SEND WhatsApp to ${phone}: Engagement message type=${type} for ${restaurantName}`,
      );
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

export function createEngagementWorker(): Worker<EngagementJobData> {
  const worker = new Worker<EngagementJobData>("engagement", processEngagement, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`Engagement job ${job.id} completed (type: ${job.data.type})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Engagement job ${job?.id} failed:`, err.message);
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
