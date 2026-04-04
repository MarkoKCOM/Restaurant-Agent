import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { redisConnection } from "./index.js";

export interface ReminderJobData {
  reservationId: string;
  restaurantId: string;
  guestId: string;
  guestPhone: string;
  date: string;
  timeStart: string;
  partySize: number;
}

async function processReminder(job: Job<ReminderJobData>): Promise<void> {
  const { guestPhone, date, timeStart, partySize, reservationId } = job.data;

  // TODO: Replace with WhatsApp sender once Baileys integration is ready
  console.log(
    `REMINDER: Would send WhatsApp to ${guestPhone} for reservation at ${timeStart} on ${date} (party of ${partySize}, id: ${reservationId})`,
  );
}

export function createReminderWorker(): Worker<ReminderJobData> {
  const worker = new Worker<ReminderJobData>("reservation-reminders", processReminder, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`Reminder job ${job.id} completed for reservation ${job.data.reservationId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Reminder job ${job?.id} failed:`, err.message);
  });

  return worker;
}
