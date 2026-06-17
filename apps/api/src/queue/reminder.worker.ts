import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { redisConnection } from "./index.js";
import { buildWorkerJobLogContext } from "./logging.js";
import { runJobWithTenant } from "./tenant-job.js";
import { recordOutboundDelivery } from "../services/outbound-message.service.js";

export interface ReminderJobData {
  reservationId: string;
  restaurantId: string;
  guestId: string;
  guestPhone: string;
  date: string;
  timeStart: string;
  partySize: number;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

async function processReminder(job: Job<ReminderJobData>, logger: FastifyBaseLogger): Promise<void> {
  const { guestPhone, date, timeStart, partySize, reservationId } = job.data;
  const text = `Reminder: your reservation is on ${date} at ${timeStart} for ${partySize} guests. Reply confirm or cancel.`;
  const outbound = await recordOutboundDelivery({
    restaurantId: job.data.restaurantId,
    guestId: job.data.guestId,
    recipient: guestPhone,
    messageType: "reservation_reminder",
    messageCategory: "transactional",
    subjectType: "reservation",
    subjectId: reservationId,
    text,
    payload: {
      queue: "reservation-reminders",
      bullJobId: job.id,
      date,
      timeStart,
      partySize,
    },
  });

  // TODO: Replace with WhatsApp sender once Baileys integration is ready
  logger.info(
    {
      queue: "reservation-reminders",
      jobId: job.id,
      outboundMessageId: outbound.id,
      reservationId,
      restaurantId: job.data.restaurantId,
      guestId: job.data.guestId,
      guestPhoneMasked: maskPhone(guestPhone),
      date,
      timeStart,
      partySize,
    },
    "Reservation reminder ready to send",
  );
}

export function createReminderWorker(logger: FastifyBaseLogger): Worker<ReminderJobData> {
  const worker = new Worker<ReminderJobData>("reservation-reminders", (job) => runJobWithTenant(job, (j) => processReminder(j, logger)), {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info(
      {
        queue: "reservation-reminders",
        jobId: job.id,
        reservationId: job.data.reservationId,
        restaurantId: job.data.restaurantId,
      },
      "Reminder job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        err,
        code: "QUEUE_RESERVATION_REMINDER_JOB_FAILED",
        queue: "reservation-reminders",
        ...buildWorkerJobLogContext(job),
        reservationId: job?.data.reservationId,
        restaurantId: job?.data.restaurantId,
        guestId: job?.data.guestId,
      },
      "Reminder job failed",
    );
  });

  return worker;
}
