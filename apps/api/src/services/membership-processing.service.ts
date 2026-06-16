import { membershipProcessingFailureRepository } from "../repositories/membership-processing-failure.repository.js";
import { refreshVisitAutoTags } from "./guest.service.js";
import { onVisitCompleted } from "./loyalty.service.js";
import { updateStreak } from "./challenge.service.js";
import { scheduleReviewRequest, scheduleThankYou } from "./engagement.service.js";
import { awardVisitAchievements } from "./achievement.service.js";

export type MembershipProcessingStage =
  | "visit_auto_tags"
  | "loyalty_updates"
  | "achievement_update"
  | "streak_update"
  | "challenge_progress"
  | "engagement_scheduling";

export type { MembershipProcessingFailureRow } from "../repositories/membership-processing-failure.repository.js";
import type { MembershipProcessingFailureRow } from "../repositories/membership-processing-failure.repository.js";

function errorDetails(error: unknown): {
  errorName: string;
  errorCode: string | null;
  errorMessage: string;
} {
  if (error instanceof Error) {
    const coded = error as Error & { code?: string };
    return {
      errorName: error.name,
      errorCode: coded.code ?? null,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "UnknownError",
    errorCode: null,
    errorMessage: String(error),
  };
}

export async function recordMembershipProcessingFailure(input: {
  restaurantId: string;
  guestId: string;
  reservationId: string;
  stage: MembershipProcessingStage;
  error: unknown;
}): Promise<MembershipProcessingFailureRow> {
  return membershipProcessingFailureRepository.insert({
    restaurantId: input.restaurantId,
    guestId: input.guestId,
    reservationId: input.reservationId,
    stage: input.stage,
    status: "open",
    ...errorDetails(input.error),
    attempts: 1,
    lastAttemptAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function listMembershipProcessingFailures(params: {
  restaurantId: string;
  status?: "open" | "resolved";
  limit?: number;
}): Promise<MembershipProcessingFailureRow[]> {
  return membershipProcessingFailureRepository.list(params);
}

async function runStage(failure: MembershipProcessingFailureRow): Promise<void> {
  const stage = failure.stage as MembershipProcessingStage;

  if (stage === "visit_auto_tags") {
    await refreshVisitAutoTags(failure.guestId);
    return;
  }

  if (stage === "loyalty_updates") {
    if (!failure.reservationId) {
      throw new Error("Cannot retry loyalty updates without a reservationId");
    }
    await onVisitCompleted(failure.guestId, failure.restaurantId, failure.reservationId);
    return;
  }

  if (stage === "achievement_update") {
    await awardVisitAchievements(failure.guestId);
    return;
  }

  if (stage === "streak_update") {
    await updateStreak(failure.guestId, failure.restaurantId, {
      reservationId: failure.reservationId ?? undefined,
    });
    return;
  }

  if (stage === "challenge_progress") {
    throw new Error(
      "Challenge progress retry requires manual review until per-reservation challenge idempotency is available",
    );
  }

  if (stage === "engagement_scheduling") {
    const reservationId = failure.reservationId ?? failure.id;
    await scheduleThankYou(failure.guestId, failure.restaurantId, reservationId);
    await scheduleReviewRequest(failure.guestId, failure.restaurantId, reservationId);
    return;
  }

  throw new Error(`Unsupported membership processing stage: ${failure.stage}`);
}

export async function retryMembershipProcessingFailure(params: {
  failureId: string;
  restaurantId: string;
}): Promise<MembershipProcessingFailureRow | null> {
  const failure = await membershipProcessingFailureRepository.findByIdInRestaurant(
    params.failureId,
    params.restaurantId,
  );

  if (!failure) return null;
  if (failure.status === "resolved") return failure;

  try {
    await runStage(failure);
    return await membershipProcessingFailureRepository.markResolved(failure.id);
  } catch (error: unknown) {
    const updated = await membershipProcessingFailureRepository.markRetryFailed(
      failure.id,
      errorDetails(error),
    );

    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      failure: updated,
    });
  }
}
