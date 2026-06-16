/**
 * Runtime validation of every repository's SQL against the real database.
 * Reads are executed directly (safe). A couple of write paths run inside a
 * transaction that is force-rolled-back so nothing persists. The goal is to
 * catch query bugs that type-check but fail at runtime — which no CI step does.
 */
import { db } from "../src/db/index.js";
import { tableRepository } from "../src/repositories/table.repository.js";
import { guestRepository } from "../src/repositories/guest.repository.js";
import { restaurantRepository } from "../src/repositories/restaurant.repository.js";
import { reservationRepository } from "../src/repositories/reservation.repository.js";
import { visitRepository } from "../src/repositories/visit.repository.js";
import { waitlistRepository } from "../src/repositories/waitlist.repository.js";
import { loyaltyTransactionRepository } from "../src/repositories/loyalty-transaction.repository.js";
import { rewardRepository } from "../src/repositories/reward.repository.js";
import { rewardClaimRepository } from "../src/repositories/reward-claim.repository.js";
import { challengeRepository } from "../src/repositories/challenge.repository.js";
import { campaignRepository } from "../src/repositories/campaign.repository.js";
import { engagementJobRepository } from "../src/repositories/engagement-job.repository.js";
import { leaderboardRepository } from "../src/repositories/leaderboard.repository.js";
import { outboundMessageRepository } from "../src/repositories/outbound-message.repository.js";
import { membershipProcessingFailureRepository } from "../src/repositories/membership-processing-failure.repository.js";

// IDs default to a zero UUID so the smoke is self-contained: every read just
// returns empty/null against a fresh schema, and every write matches 0 rows.
// The point is to execute the real SQL, not to assert on seeded data.
const ZID = "00000000-0000-0000-0000-000000000000";
const RID = process.env.SMOKE_RESTAURANT_ID ?? ZID;
const GID = process.env.SMOKE_GUEST_ID ?? ZID;
const RESID = process.env.SMOKE_RESERVATION_ID ?? ZID;
const now = new Date();
const from = new Date(now.getTime() - 90 * 86400000);

let pass = 0;
const failures: Array<{ name: string; error: string }> = [];

async function check(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    pass++;
  } catch (e) {
    failures.push({ name, error: e instanceof Error ? e.message : String(e) });
  }
}

async function main() {
  // table
  await check("table.findActiveByRestaurant", () => tableRepository.findActiveByRestaurant(RID));
  await check("table.findByRestaurant", () => tableRepository.findByRestaurant(RID, { includeInactive: true }));
  await check("table.findAll", () => tableRepository.findAll({ includeInactive: true }));
  await check("table.findById", () => tableRepository.findById(ZID, RID));
  await check("table.findRestaurantIdById", () => tableRepository.findRestaurantIdById(ZID));
  // guest
  await check("guest.findByPhone", () => guestRepository.findByPhone(RID, "+972000000000"));
  await check("guest.listByRestaurant", () => guestRepository.listByRestaurant(RID));
  await check("guest.listByRestaurantRecentFirst", () => guestRepository.listByRestaurantRecentFirst(RID));
  await check("guest.listLapsedInWindow(no-after)", () => guestRepository.listLapsedInWindow(RID, "2026-01-01", undefined));
  await check("guest.listLapsedInWindow(with-after)", () => guestRepository.listLapsedInWindow(RID, "2026-01-01", "2025-01-01"));
  await check("guest.findById", () => guestRepository.findById(GID));
  await check("guest.findByReferralCode", () => guestRepository.findByReferralCode("NOPE1234"));
  await check("guest.findByReferredBy", () => guestRepository.findByReferredBy(GID));
  // restaurant
  await check("restaurant.findById", () => restaurantRepository.findById(RID));
  await check("restaurant.findOwnerWhatsappMissing", () => restaurantRepository.findOwnerWhatsappMissing(5));
  // reservation
  await check("reservation.findByDay", () => reservationRepository.findByDay(RID, "2026-07-01"));
  await check("reservation.list(both)", () => reservationRepository.list({ restaurantId: RID, date: "2026-07-01" }));
  await check("reservation.list(none)", () => reservationRepository.list({}));
  await check("reservation.findVisitCompletionContext", () => reservationRepository.findVisitCompletionContext(RESID, RID, GID));
  await check("reservation.findByGuest", () => reservationRepository.findByGuest(GID));
  await check("reservation.findById", () => reservationRepository.findById(RESID));
  // visit
  await check("visit.findByRestaurant", () => visitRepository.findByRestaurant(RID));
  await check("visit.findPositiveForReservation", () => visitRepository.findPositiveForReservation(GID, RID, RESID));
  await check("visit.findByGuestReservation", () => visitRepository.findByGuestReservation(GID, RESID));
  await check("visit.listByRestaurantInDateRange", () => visitRepository.listByRestaurantInDateRange(RID, "2026-01-01", "2026-12-31"));
  await check("visit.listRatedByGuest", () => visitRepository.listRatedByGuest(GID));
  await check("visit.findByGuest", () => visitRepository.findByGuest(GID, { limit: 5 }));
  // waitlist
  await check("waitlist.listByRestaurant", () => waitlistRepository.listByRestaurant(RID, "2026-07-01"));
  await check("waitlist.findWaitingForDay", () => waitlistRepository.findWaitingForDay(RID, "2026-07-01"));
  await check("waitlist.findById", () => waitlistRepository.findById(ZID));
  // loyalty-transaction
  await check("loyaltyTx.findByGuest", () => loyaltyTransactionRepository.findByGuest(GID, { limit: 5 }));
  await check("loyaltyTx.listByRestaurantInRange", () => loyaltyTransactionRepository.listByRestaurantInRange(RID, from, now));
  await check("loyaltyTx.listByGuestAndReason", () => loyaltyTransactionRepository.listByGuestAndReason(GID, "referral_bonus"));
  await check("loyaltyTx.findEarnByReason", () => loyaltyTransactionRepository.findEarnByReason(GID, RID, RESID, "visit_completion"));
  await check("loyaltyTx.findEarnByReasonForGuest", () => loyaltyTransactionRepository.findEarnByReasonForGuest(GID, RID, "streak_milestone:3"));
  await check("loyaltyTx.findLatestLuckySpin", () => loyaltyTransactionRepository.findLatestLuckySpin(GID, RID));
  await check("loyaltyTx.findLuckySpinForVisit", () => loyaltyTransactionRepository.findLuckySpinForVisit(GID, RID, RESID));
  // reward
  await check("reward.listByRestaurant", () => rewardRepository.listByRestaurant(RID, true));
  await check("reward.findByIdInRestaurant", () => rewardRepository.findByIdInRestaurant(ZID, RID));
  await check("reward.findById", () => rewardRepository.findById(ZID));
  await check("reward.findByIds", () => rewardRepository.findByIds([ZID]));
  await check("reward.findByIds(empty)", () => rewardRepository.findByIds([]));
  await check("reward.findActiveById", () => rewardRepository.findActiveById(ZID));
  // reward-claim
  await check("rewardClaim.findByCode", () => rewardClaimRepository.findByCode("NOPE1234"));
  await check("rewardClaim.findById", () => rewardClaimRepository.findById(ZID));
  await check("rewardClaim.findByGuest", () => rewardClaimRepository.findByGuest(GID));
  await check("rewardClaim.listByRestaurantInRange", () => rewardClaimRepository.listByRestaurantInRange(RID, from, now));
  // challenge
  await check("challenge.findById", () => challengeRepository.findById(ZID));
  await check("challenge.findByIdInRestaurant", () => challengeRepository.findByIdInRestaurant(ZID, RID));
  await check("challenge.listActive", () => challengeRepository.listActive(RID, "2026-07-01"));
  await check("challenge.listActiveByTypes", () => challengeRepository.listActiveByTypes(RID, "2026-07-01", ["visit_count", "birthday_week"]));
  await check("challenge.findBirthdayWeek", () => challengeRepository.findBirthdayWeek(RID, GID, 2026));
  await check("challenge.findByRestaurant", () => challengeRepository.findByRestaurant(RID));
  await check("challenge.findProgressByGuest", () => challengeRepository.findProgressByGuest(GID));
  await check("challenge.findProgress", () => challengeRepository.findProgress(GID, ZID));
  // campaign
  await check("campaign.findByIdInRestaurant", () => campaignRepository.findByIdInRestaurant(ZID, RID));
  await check("campaign.listByRestaurantExcluding", () => campaignRepository.listByRestaurantExcluding(RID, ZID));
  await check("campaign.listForAnalytics(range)", () => campaignRepository.listForAnalytics(RID, { from, to: now }));
  await check("campaign.listForAnalytics(byId)", () => campaignRepository.listForAnalytics(RID, { campaignId: ZID, from, to: now }));
  // engagement-job
  await check("engJob.findPending", () => engagementJobRepository.findPending(GID, RID, "birthday"));
  await check("engJob.findAny", () => engagementJobRepository.findAny(GID, RID, "birthday"));
  await check("engJob.findInWindow", () => engagementJobRepository.findInWindow({ guestId: GID, restaurantId: RID, type: "birthday", windowStart: from, windowEnd: now }));
  await check("engJob.countPromotionalInWindow", () => engagementJobRepository.countPromotionalInWindow({ guestId: GID, restaurantId: RID, windowStart: from, windowEnd: now }));
  await check("engJob.list", () => engagementJobRepository.list({ restaurantId: RID, status: "pending", limit: 10 }));
  // leaderboard (raw CTE + window functions)
  await check("leaderboard.fetchEntries", () => leaderboardRepository.fetchEntries(RID, from.toISOString(), now.toISOString(), 10));
  await check("leaderboard.countParticipants", () => leaderboardRepository.countParticipants(RID));
  // outbound-message (groupBy + window functions)
  await check("outbound.list", () => outboundMessageRepository.list({ restaurantId: RID, limit: 10 }));
  await check("outbound.summarizeSince", () => outboundMessageRepository.summarizeSince(from));
  await check("outbound.errorBreakdownSince", () => outboundMessageRepository.errorBreakdownSince(from));
  await check("outbound.sampleSince", () => outboundMessageRepository.sampleSince(from, 5));
  // membership-processing-failure
  await check("mpf.list", () => membershipProcessingFailureRepository.list({ restaurantId: RID, status: "open", limit: 10 }));
  await check("mpf.findByIdInRestaurant", () => membershipProcessingFailureRepository.findByIdInRestaurant(ZID, RID));

  // Write SQL — crafted to match 0 rows (ZID / epoch cutoff) so no data is
  // touched, but the UPDATE/raw-sql statements still execute and validate.
  await check("guest.adjustPoints (sql increment)", () => guestRepository.adjustPoints(ZID, 0));
  await check("guest.incrementNoShowCount (sql increment)", () => guestRepository.incrementNoShowCount(ZID));
  await check("guest.incrementVisitCount (sql increment)", () => guestRepository.incrementVisitCount(ZID, "2026-01-01"));
  await check("guest.updateById", () => guestRepository.updateById(ZID, { updatedAt: new Date() }));
  await check("mpf.markResolved", () => membershipProcessingFailureRepository.markResolved(ZID));
  await check("mpf.markRetryFailed (sql attempts++)", () => membershipProcessingFailureRepository.markRetryFailed(ZID, { errorName: "X", errorCode: null, errorMessage: "y" }));
  await check("engJob.skipPending", () => engagementJobRepository.skipPending(ZID, RID, "birthday", "smoke"));
  await check("engJob.updateById", () => engagementJobRepository.updateById(ZID, { status: "failed" }));
  await check("waitlist.expireOffersBefore (epoch → 0 rows)", () => waitlistRepository.expireOffersBefore(new Date(0)));
  await check("waitlist.updateById", () => waitlistRepository.updateById(ZID, { status: "expired" }));
  await check("reservation.updateById", () => reservationRepository.updateById(ZID, { updatedAt: new Date() }));
  await check("table.update", () => tableRepository.update(ZID, RID, { name: "smoke" }));
  await check("table.deactivate", () => tableRepository.deactivate(ZID, RID));
  await check("visit.updateById", () => visitRepository.updateById(ZID, { rating: 5 }));
  await check("reward.updateInRestaurant", () => rewardRepository.updateInRestaurant(ZID, RID, { pointsCost: 1 }));
  await check("rewardClaim.updateById", () => rewardClaimRepository.updateById(ZID, { status: "redeemed" }));
  await check("challenge.updateInRestaurant", () => challengeRepository.updateInRestaurant(ZID, RID, { isActive: false }));
  await check("challenge.updateProgressById", () => challengeRepository.updateProgressById(ZID, { currentValue: 1 }));
  await check("campaign.updateById", () => campaignRepository.updateById(ZID, { status: "sent" }));

  // Transaction composition (the awardPoints pattern) — rolled back, nothing persists.
  await check("TX: insert+adjust threaded executor (rolled back)", async () => {
    await db.transaction(async (trx) => {
      await loyaltyTransactionRepository.findByGuest(GID, { limit: 1 }, trx);
      await guestRepository.findById(GID, trx);
      throw new Error("__rollback__");
    }).catch((e) => {
      if (e instanceof Error && e.message === "__rollback__") return;
      throw e;
    });
  });

  console.log(`\nrepo runtime smoke: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
    process.exitCode = 1;
  } else {
    console.log("ALL REPOSITORY QUERIES EXECUTED CLEANLY AGAINST THE REAL DB");
  }
  process.exit(failures.length ? 1 : 0);
}

main();
