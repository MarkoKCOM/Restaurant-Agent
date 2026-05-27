#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const tempDir = await mkdtemp(join(tmpdir(), "openseat-debug-tools-"));

async function writeJson(name, value) {
  const path = join(tempDir, name);
  await mkdir(tempDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

async function summarize(path) {
  const { stdout } = await execFileAsync("node", ["scripts/summarize-debug-artifact.mjs", path], {
    cwd: process.cwd(),
  });
  return stdout;
}

async function expectCommandFailure(command, args, options = {}) {
  try {
    await execFileAsync(command, args, {
      cwd: process.cwd(),
      ...options,
    });
  } catch (error) {
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }

  throw new Error(`Expected ${command} ${args.join(" ")} to fail`);
}

function assertIncludes(output, expected) {
  if (!output.includes(expected)) {
    throw new Error(`Expected output to include ${JSON.stringify(expected)}.\nOutput:\n${output}`);
  }
}

function assertNotIncludes(output, expected) {
  if (output.includes(expected)) {
    throw new Error(`Expected output not to include ${JSON.stringify(expected)}.\nOutput:\n${output}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function deployWorkflowMatches(path) {
  const exactMatches = new Set([
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
  ]);
  const prefixMatches = [
    "apps/booking-widget/",
    "apps/dashboard/",
    "apps/marketing-site/",
    "packages/",
  ];

  return exactMatches.has(path) || prefixMatches.some((prefix) => path.startsWith(prefix));
}

function deployAppImpacts(path) {
  const allApps = { dashboard: true, marketing: true, widget: true };
  if (["pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json"].includes(path) || path.startsWith("packages/")) {
    return allApps;
  }
  return {
    dashboard: path.startsWith("apps/dashboard/"),
    marketing: path.startsWith("apps/marketing-site/"),
    widget: path.startsWith("apps/booking-widget/"),
  };
}

const smokePath = await writeJson("smoke.json", {
  status: "failed",
  runId: "smoke-test",
  baseUrl: "http://localhost:3001",
  steps: [
    { step: "login" },
    { step: "membership.processing-failures", openCount: 2, relatedOpenCount: 0 },
    { step: "engagement.jobs", jobCount: 2, statuses: ["pending"], types: ["thank_you", "review_request"], thankYouOutsideQuietHours: true },
    { step: "engagement.thank-you.cleanup", jobId: "engagement-job-test-1", markedSent: true },
    { step: "engagement.review-routing-positive", route: "public_review", jobStatus: "pending", reviewUrlPresent: true, delayHours: 24, sentimentSource: "rules" },
    { step: "engagement.review-routing-negative", route: "private_recovery", pendingReviewRequest: false, recoveryActions: ["send_personal_apology", "offer_next_visit_discount"], sentimentSource: "rules", ratingSentiment: "positive", negativeSignalCount: 2 },
    { step: "engagement.review-request.cleanup", jobId: "review-job-test-1", markedSent: true },
    { step: "gamification.future-challenge.window", challengeId: "future-challenge-test-1", startDate: "2026-07-26", listedAsActive: false },
    { step: "gamification.future-challenge.cleanup", challengeId: "future-challenge-test-1", isActive: false },
    { step: "gamification.expired-challenge.window", challengeId: "expired-challenge-test-1", endDate: "2026-05-26", listedAsActive: false },
    { step: "gamification.expired-challenge.cleanup", challengeId: "expired-challenge-test-1", isActive: false },
    { step: "gamification.challenge-progress", progress: 1, target: 1, status: "completed", completed: true },
    { step: "gamification.challenge-idempotency", challengeId: "challenge-test-1", progress: 1, target: 1, completed: true, pointsBefore: 15, pointsAfter: 15 },
    { step: "gamification.challenge-completion.cleanup", challengeId: "challenge-test-1", jobId: "challenge-completion-job-1", markedSent: true },
    { step: "gamification.challenge.cleanup", challengeId: "challenge-test-1", isActive: false },
    { step: "gamification.streak-after-completion", current: 3, best: 3, lastVisitWeek: "2026-W22", seeded: true },
    { step: "gamification.streak-milestone-bonus", expectedBonusPoints: 20, actualBonusPoints: 20, reason: "streak_milestone:3" },
    { step: "gamification.streak-broken-seed", current: 3, best: 3, lastVisitWeek: "2026-W19", seeded: true },
    { step: "gamification.streak-broken-recovery", current: 1, best: 3, previousCurrent: 3, jobStatus: "pending" },
    { step: "gamification.streak-broken.cleanup", jobId: "streak-broken-job-test-1", markedSent: true },
    { step: "gamification.achievements-after-completion", count: 1, badges: ["first_visit"] },
    { step: "gamification.lucky-spin-config", enabled: true, triggerEvery: 1, prizeCount: 1, prizePoints: 15 },
    { step: "gamification.lucky-spin-award", points: 15, reason: "lucky_spin:smoke_bonus" },
    { step: "gamification.leaderboard.opt-in", optedIn: true, rank: 1, pointsEarned: 45 },
    { step: "gamification.leaderboard.rank", participantCount: 1, rank: 1, pointsEarned: 45 },
    { step: "gamification.leaderboard.finalize", winnerCount: 1, rank: 1, rewardPoints: 30, summaryJobId: "leaderboard-job-test-1" },
    { step: "gamification.share-templates", count: 3, moments: ["achievement", "streak_milestone", "leaderboard_rank"], hasFirstVisit: true, hasStreak: true, hasLeaderboard: true, storyFormat: "story" },
    { step: "gamification.leaderboard.cleanup", jobId: "leaderboard-job-test-1", markedSent: true },
    { step: "gamification.lucky-spin.cleanup", jobId: "lucky-spin-job-test-1", markedSent: true },
    { step: "gamification.leaderboard.opt-out", optedIn: false },
    { step: "gamification.menu-exploration", categoryCount: 2, badges: ["first_taste", "menu_explorer"] },
    { step: "gamification.achievements-after-visit", count: 2, badges: ["first_visit", "tasting_menu"] },
    { step: "gamification.birthday-week-challenge", created: 1, skippedExisting: 0, progress: 1, target: 1, completed: true, leakedToOtherGuest: false, pointsBefore: 0, pointsAfter: 50 },
    { step: "gamification.birthday-week.cleanup", challengeId: "birthday-week-test-1", cleanedCount: 1, isActive: false, birthday: "06-27" },
    { step: "engagement.birthday-check", due: 1, scheduled: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "engagement.anniversary-check", due: 1, scheduled: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "engagement.win-back-overdue", scheduled30: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "campaign.audience-preview", matchedCount: 1, matchedWithOptOutCount: 2, excludedOptedOut: 1, hasTargetGuest: true, includesOptedOutByDefault: false, includesOptedOutWhenRequested: true },
    { step: "campaign.creation-scheduling", templateCount: 5, hasWinBackTemplate: true, quietWarning: true, adjusted: true, status: "scheduled", variables: ["guest_name", "days_since_last_visit", "reward_teaser"] },
    { step: "campaign.delivery", firstSent: 1, firstSkippedOptOut: 1, secondSent: 1, thirdSent: 0, thirdSkippedWeek: 1, hasMessagePreview: true, rateLimitedTarget: true },
    { step: "campaign.delivery-events", delivered: 1, read: 1, replied: 1, hasDeliveredAt: true, hasReadAt: true, hasRepliedAt: true },
    { step: "campaign.opt-out-keyword", optedOut: true, llmRounds: 0, deterministicAction: "campaign_opt_out", tool: "set_membership_messaging_opt_out", deliverySent: 0, deliverySkippedOptOut: 2 },
    { step: "analytics.growth-summary", reservationBookings: 12, reservationCovers: 34, reservationSlots: 5, cancellationRate: 0.1, noShowRate: 0.05, retentionUniqueGuests: 4, retentionWindows: [30, 60, 90], activeMembers: 9, pointsIssued: 120, tierBronze: 7, clvGuests: 9, clvRevenue: 4500, clvAverage: 500, clvTierCount: 3, clvTopGuests: 5, campaigns: 3, campaignSent: 2, hasCampaignRoi: true },
    { step: "analytics.daily-morning-summary", date: "2026-05-27", yesterdayCovers: 18, todayBookings: 7, todayCovers: 22, notableGuestCount: 3, alertCount: 1, ownerRecipientConfigured: true, ownerRecipientSource: "phone", hasMessage: true },
    { step: "outbound.daily-morning-summary-log", outboundMessageId: "outbound-test-1", status: "logged", messageType: "daily_morning_summary", listed: true, recipientMasked: "050****12" },
  ],
  requests: [
    {
      method: "GET",
      path: "/api/v1/health",
      status: 200,
      ok: true,
      elapsedMs: 1,
      requestId: "smoke-test-1",
      responseRequestId: "smoke-test-1",
    },
    {
      method: "POST",
      path: "/api/v1/reservations",
      status: 500,
      ok: false,
      elapsedMs: 2,
      requestId: "smoke-test-2",
      responseRequestId: "smoke-test-2",
      code: "INTERNAL_ERROR",
    },
  ],
});

const smokeOutput = await summarize(smokePath);
assertIncludes(smokeOutput, "Type: api-smoke");
assertIncludes(smokeOutput, "Operational smoke:");
assertIncludes(smokeOutput, "membership.processing-failures: open=2 related=0");
assertIncludes(smokeOutput, "engagement.jobs: count=2 statuses=pending types=thank_you,review_request thankYouQuiet=ok");
assertIncludes(smokeOutput, "engagement.thank-you.cleanup: markedSent=yes jobId=engagement-job-test-1");
assertIncludes(smokeOutput, "engagement.review-routing-positive: route=public_review status=pending reviewUrl=yes delayHours=24 source=rules");
assertIncludes(smokeOutput, "engagement.review-routing-negative: route=private_recovery pendingReview=no recoveryActions=2 source=rules ratingSentiment=positive negativeSignals=2");
assertIncludes(smokeOutput, "engagement.review-request.cleanup: markedSent=yes jobId=review-job-test-1");
assertIncludes(smokeOutput, "gamification.future-challenge.window: listedActive=no startDate=2026-07-26");
assertIncludes(smokeOutput, "gamification.future-challenge.cleanup: active=no challengeId=future-challenge-test-1");
assertIncludes(smokeOutput, "gamification.expired-challenge.window: listedActive=no endDate=2026-05-26");
assertIncludes(smokeOutput, "gamification.expired-challenge.cleanup: active=no challengeId=expired-challenge-test-1");
assertIncludes(smokeOutput, "gamification.challenge-progress: progress=1/1 status=completed completed=yes");
assertIncludes(smokeOutput, "gamification.challenge-idempotency: progress=1/1 points=15->15 duplicateAward=no");
assertIncludes(smokeOutput, "gamification.challenge-completion.cleanup: markedSent=yes jobId=challenge-completion-job-1");
assertIncludes(smokeOutput, "gamification.challenge.cleanup: active=no challengeId=challenge-test-1");
assertIncludes(smokeOutput, "gamification.streak-after-completion: current=3 best=3 week=2026-W22 seeded=true");
assertIncludes(smokeOutput, "gamification.streak-milestone-bonus: points=20/20 reason=streak_milestone:3");
assertIncludes(smokeOutput, "gamification.streak-broken-seed: current=3 best=3 week=2026-W19 seeded=true");
assertIncludes(smokeOutput, "gamification.streak-broken-recovery: current=1 best=3 previous=3 status=pending");
assertIncludes(smokeOutput, "gamification.streak-broken.cleanup: markedSent=yes jobId=streak-broken-job-test-1");
assertIncludes(smokeOutput, "gamification.achievements-after-completion: count=1 badges=first_visit");
assertIncludes(smokeOutput, "gamification.lucky-spin-config: enabled=yes every=1 prizes=1 points=15");
assertIncludes(smokeOutput, "gamification.lucky-spin-award: points=15 reason=lucky_spin:smoke_bonus");
assertIncludes(smokeOutput, "gamification.leaderboard.opt-in: optedIn=yes rank=1 points=45");
assertIncludes(smokeOutput, "gamification.leaderboard.rank: participants=1 rank=1 points=45");
assertIncludes(smokeOutput, "gamification.leaderboard.finalize: winners=1 rank=1 reward=30 summaryJob=yes");
assertIncludes(smokeOutput, "gamification.share-templates: count=3 moments=achievement,streak_milestone,leaderboard_rank firstVisit=yes streak=yes leaderboard=yes format=story");
assertIncludes(smokeOutput, "gamification.leaderboard.cleanup: markedSent=yes jobId=leaderboard-job-test-1");
assertIncludes(smokeOutput, "gamification.lucky-spin.cleanup: markedSent=yes jobId=lucky-spin-job-test-1");
assertIncludes(smokeOutput, "gamification.leaderboard.opt-out: optedIn=no");
assertIncludes(smokeOutput, "gamification.menu-exploration: categories=2 badges=first_taste,menu_explorer");
assertIncludes(smokeOutput, "gamification.achievements-after-visit: count=2 badges=first_visit,tasting_menu");
assertIncludes(smokeOutput, "gamification.birthday-week-challenge: created=1 existing=0 progress=1/1 completed=yes leaked=no points=0->50");
assertIncludes(smokeOutput, "gamification.birthday-week.cleanup: active=no cleaned=1 challengeId=birthday-week-test-1 birthday=06-27");
assertIncludes(smokeOutput, "engagement.birthday-check: due=1 scheduled=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "engagement.anniversary-check: due=1 scheduled=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "engagement.win-back-overdue: scheduled30=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "campaign.audience-preview: matched=1 withOptOut=2 excludedOptedOut=1 target=yes optedOutDefault=no optedOutRequested=yes");
assertIncludes(smokeOutput, "campaign.creation-scheduling: templates=5 winBack=yes quietWarning=yes adjusted=yes status=scheduled variables=guest_name,days_since_last_visit,reward_teaser");
assertIncludes(smokeOutput, "campaign.delivery: firstSent=1 firstOptOut=1 secondSent=1 thirdSent=0 thirdWeekLimit=1 preview=yes rateLimitedTarget=yes");
assertIncludes(smokeOutput, "campaign.delivery-events: delivered=1 read=1 replied=1 deliveredAt=yes readAt=yes repliedAt=yes");
assertIncludes(smokeOutput, "campaign.opt-out-keyword: optedOut=yes llmRounds=0 action=campaign_opt_out tool=set_membership_messaging_opt_out sent=0 skippedOptOut=2");
assertIncludes(smokeOutput, "analytics.growth-summary: bookings=12 covers=34 slots=5 cancelRate=0.1 noShowRate=0.05 retentionGuests=4 windows=30,60,90 members=9 pointsIssued=120 bronze=7 clvGuests=9 clvRevenue=4500 clvAvg=500 clvTiers=3 clvTop=5 campaigns=3 sent=2 roi=yes");
assertIncludes(smokeOutput, "analytics.daily-morning-summary: date=2026-05-27 yesterdayCovers=18 todayBookings=7 todayCovers=22 notable=3 alerts=1 message=yes ownerRecipient=yes source=phone");
assertIncludes(smokeOutput, "outbound.daily-morning-summary-log: id=outbound-test-1 status=logged type=daily_morning_summary listed=yes recipient=050****12");
assertIncludes(smokeOutput, "Unhandled HTTP failures: 1");
assertIncludes(smokeOutput, "Last smoke steps:");
assertIncludes(smokeOutput, "- campaign.opt-out-keyword optedOut=true llmRounds=0 deterministicAction=campaign_opt_out tool=set_membership_messaging_opt_out deliverySent=0 deliverySkippedOptOut=2");
assertIncludes(smokeOutput, "- analytics.growth-summary reservationBookings=12 reservationCovers=34 reservationSlots=5 cancellationRate=0.1 noShowRate=0.05 retentionUniqueGuests=4 retentionWindows=30,60,90 activeMembers=9");
assertIncludes(smokeOutput, "- outbound.daily-morning-summary-log outboundMessageId=outbound-test-1 status=logged messageType=daily_morning_summary listed=true recipientMasked=050****12");
assertIncludes(smokeOutput, "Recent requests:");
assertIncludes(smokeOutput, "- GET /api/v1/health -> 200 requestId=smoke-test-1");
assertIncludes(smokeOutput, "POST /api/v1/reservations -> 500 code=INTERNAL_ERROR requestId=smoke-test-2");
assertIncludes(smokeOutput, 'pnpm debug:logs smoke-test-1 --since "2 hours ago"');
assertIncludes(smokeOutput, 'pnpm debug:logs smoke-test-2 --since "2 hours ago"');

const skippedSmokePath = await writeJson("smoke-skipped.json", {
  status: "skipped",
  reason: "missing credentials",
});

const skippedOutput = await summarize(skippedSmokePath);
assertIncludes(skippedOutput, "Status: skipped");
assertIncludes(skippedOutput, "Reason: missing credentials");

const failedProbe = await expectCommandFailure("node", [
  "scripts/api-debug-probe.mjs",
  "http://127.0.0.1:65535/api/v1/health",
], {
  env: {
    ...process.env,
    REQUEST_ID: "debug-fetch-failed-test",
  },
});
assertIncludes(failedProbe.stdout, '"status": null');
assertIncludes(failedProbe.stdout, '"ok": false');
assertIncludes(failedProbe.stdout, '"requestId": "debug-fetch-failed-test"');
assertIncludes(failedProbe.stdout, '"error"');
assertIncludes(failedProbe.stdout, '"cause"');

const missingMembershipDebugEnv = await expectCommandFailure("node", [
  "scripts/membership-debug-summary.mjs",
], {
  env: {
    ...process.env,
    OPENSEAT_TOKEN: "",
    OPENSEAT_RESTAURANT_ID: "",
    OPENSEAT_RESTAURANT_SLUG: "",
  },
});
assertIncludes(missingMembershipDebugEnv.stderr, "Missing OPENSEAT_TOKEN and a restaurant selector");
assertIncludes(missingMembershipDebugEnv.stderr, "pnpm debug:membership");
assertIncludes(missingMembershipDebugEnv.stderr, "JWT_SECRET");
assertIncludes(missingMembershipDebugEnv.stderr, "Restaurant admin tokens can also infer");

const agentIntentPath = await writeJson("agent-intents.json", {
  type: "agent-membership-intent",
  status: "failed",
  runId: "agent-intent-test",
  apiUrl: "http://localhost:3001",
  total: 2,
  passed: 1,
  failed: 1,
  results: [
    {
      name: "Hebrew balance",
      requestId: "agent-intent-test-1",
      ok: true,
      observed: { intent: "membership_summary", expectedTool: "get_membership_summary", language: "he" },
      mismatches: [],
    },
    {
      name: "English opt-out",
      requestId: "agent-intent-test-2",
      ok: false,
      observed: { intent: "unknown", expectedTool: null, language: "en" },
      mismatches: ["intent expected messaging_opt_out got unknown"],
    },
  ],
});

const agentIntentOutput = await summarize(agentIntentPath);
assertIncludes(agentIntentOutput, "Type: agent-membership-intent");
assertIncludes(agentIntentOutput, "Status: 1/2 passed");
assertIncludes(agentIntentOutput, "- English opt-out: intent expected messaging_opt_out got unknown requestId=agent-intent-test-2");
assertIncludes(agentIntentOutput, 'pnpm debug:logs agent-intent-test-2 --since "2 hours ago"');

const agentIntentFetchFailurePath = await writeJson("agent-intents-fetch-failed.json", {
  type: "agent-membership-intent",
  status: "failed",
  runId: "agent-intent-fetch-failed-test",
  apiUrl: "http://127.0.0.1:65535",
  total: 1,
  passed: 0,
  failed: 1,
  results: [
    {
      name: "Hebrew balance",
      requestId: "agent-intent-fetch-failed-test-1",
      ok: false,
      status: null,
      error: {
        name: "TypeError",
        message: "fetch failed",
        cause: { code: "ECONNREFUSED", address: "127.0.0.1", port: 65535 },
      },
      mismatches: ["fetch failed"],
    },
  ],
});

const agentIntentFetchFailureOutput = await summarize(agentIntentFetchFailurePath);
assertIncludes(agentIntentFetchFailureOutput, "Type: agent-membership-intent");
assertIncludes(agentIntentFetchFailureOutput, "fetch failed code=ECONNREFUSED requestId=agent-intent-fetch-failed-test-1");

const queueDebugSummaryPath = join(tempDir, "queue-debug-summary.txt");
await writeFile(queueDebugSummaryPath, [
  "OpenSeat Queue Debug Summary",
  "Queue: daily-summary",
  "summary schedule health:",
  "- restaurants=9",
  "- daily-morning-summary expected=9 found=9 pattern=0 9 * * * status=ok",
  "- daily-summary expected=9 found=9 pattern=0 23 * * * status=ok",
  "- restaurantTimezones=Asia/Jerusalem:9",
  "Queue: engagement",
  "engagement schedule health:",
  "- restaurants=9",
  "- win-back-check expected=9 found=9 pattern=0 10 * * * status=ok",
  "- birthday-check expected=9 found=9 pattern=0 9 * * * status=ok",
  "- anniversary-check expected=9 found=9 pattern=15 9 * * * status=ok",
  "- birthday-week-challenge-check expected=9 found=9 pattern=30 9 * * * status=ok",
  "- restaurantTimezones=Asia/Jerusalem:9",
  "Queue: campaign-delivery",
  "campaign delivery health:",
  "- status=attention total=6 draft=1 scheduled=2 sent=3 overdue=1",
  "- deliverySent=12 skipped=4 optedOut=2 weekLimit=1 monthLimit=1 recipientRows=16",
  "campaign skipped reasons:",
  "- guest_opted_out_campaigns: 2",
  "- campaign_weekly_limit_reached: 1",
  "overdue campaign samples:",
  "- May win-back id=campaign-1 restaurantId=restaurant-1 scheduledAt=2026-05-27T09:00:00.000Z",
  "failed samples:",
  "- none",
  "",
].join("\n"));

const membershipDebugSummaryPath = join(tempDir, "membership-debug-summary.txt");
await writeFile(membershipDebugSummaryPath, [
  "Membership Debug Summary",
  "restaurantId=restaurant-1",
  "failuresRequestId=debug-membership-failures-1",
  "engagementRequestId=debug-membership-engagement-1",
  "",
  "Overdue pending engagement jobs: 2",
  "- job-overdue-1 type=win_back_30 status=pending category=promotional guest=guest-1 triggerAt=2026-05-27T09:00:00.000Z ageMinutes=90",
  "",
  "Failed engagement jobs: 1",
  "- job-failed-1 type=thank_you status=failed category=transactional guest=guest-2 triggerAt=2026-05-27T08:00:00.000Z ageMinutes=150",
  "",
  "Recent skipped engagement reasons:",
  "- job-skipped-1 type=win_back_30 status=skipped category=promotional guest=guest-3 triggerAt=2026-05-27T07:00:00.000Z ageMinutes=210 skipReason=guest_opted_out_promotional",
  "- job-skipped-2 type=win_back_60 status=skipped category=promotional guest=guest-4 triggerAt=2026-05-27T06:00:00.000Z ageMinutes=270 skipReason=weekly_promotional_limit_reached",
  "- job-skipped-3 type=win_back_90 status=skipped category=promotional guest=guest-5 triggerAt=2026-05-27T05:00:00.000Z ageMinutes=330 skipReason=weekly_promotional_limit_reached",
  "",
].join("\n"));

const debugBundleManifestPath = await writeJson("manifest.json", {
  createdAt: "2026-05-27T12:00:00.000Z",
  apiUrl: "http://localhost:3001",
  service: "openseat-api",
  since: "30 minutes ago",
  logWindows: {
    contextSince: "30 minutes ago",
    bundleRunSince: "2026-05-27T12:00:00.000Z",
  },
  options: {
    failOnApiLogIssues: true,
  },
  outDir: "/tmp/openseat-debug-bundle",
  readiness: { status: "ready", attempts: 1 },
  commands: [
    { name: "health-probe", status: "passed", outputPath: "/tmp/openseat-debug-bundle/health-probe.txt" },
    { name: "queue-debug-summary", status: "passed", outputPath: queueDebugSummaryPath },
    { name: "membership-debug-summary", status: "passed", outputPath: membershipDebugSummaryPath },
    {
      name: "api-smoke",
      status: "failed",
      exitCode: 1,
      outputPath: "/tmp/openseat-debug-bundle/api-smoke.txt",
    },
    { name: "admin-diagnostics", status: "skipped", reason: "missing token" },
  ],
  highlights: {
    adminDiagnostics: {
      status: "degraded",
      source: {
        shortCommit: "abc1234",
        checkout: { shortCommit: "abc1234", branch: "main" },
        checkoutMatchesBuild: true,
      },
      migrationDrift: {
        status: "ok",
        codeLatestId: "202605270001",
        databaseLatestId: "202605270001",
      },
      checks: {
        database: "ok",
        redis: "ok",
      },
      membershipProcessing: {
        status: "ok",
        openCount: 2,
        totalOpenAttempts: 3,
        openSamples: [
          {
            id: "mpf-1",
            stage: "loyalty",
            guestId: "guest-1",
            reservationId: "res-1",
            errorCode: "POINTS_WRITE_FAILED",
          },
        ],
      },
      gamification: {
        status: "attention",
        challenges: {
          active: 2,
          activeSmokeChallenges: 1,
          activeBirthdayWeekChallenges: 1,
          birthdayWeekDueUncreated: 1,
          stuckCompletions: 1,
          duplicateProgressGroups: 1,
          stuckSamples: [
            { id: "progress-1", guestId: "guest-2", challengeId: "challenge-1", currentValue: 5, targetValue: 3 },
          ],
        },
        referrals: {
          guestsWithReferralCode: 7,
          referrerCreditMismatches: 1,
          referrerCreditMismatchSamples: [
            { referrerId: "guest-3", referralCount: 2, bonusCount: 1 },
          ],
        },
        menuExploration: {
          guestsWithBadges: 5,
        },
        achievements: {
          guestsWithAchievements: 4,
          firstVisitMissing: 1,
          tenVisitMissing: 1,
          invalid: 1,
          samples: [
            { guestId: "guest-4", visitCount: 10, issue: "ten_visits_achievement_missing" },
          ],
        },
        leaderboard: {
          optedIn: 3,
          topThreeRewardMissing: 1,
          invalid: 1,
          samples: [
            { guestId: "guest-5", issue: "leaderboard_monthly_reward_missing" },
          ],
        },
        streaks: {
          active: 3,
          stale: 1,
          invalid: 1,
          milestoneBonusMissing: 1,
          samples: [
            { guestId: "guest-6", current: 5, best: 5, lastVisitWeek: "2026-W19", issue: "stale_active_streak" },
          ],
        },
      },
      engagement: {
        status: "attention",
        totals: {
          pending: 4,
          overduePending: 1,
          failed: 1,
          skipped: 3,
        },
        winBack: {
          dueUnscheduledTotal: 2,
        },
        birthdays: {
          dueUnscheduledToday: 1,
        },
        anniversaries: {
          dueUnscheduledToday: 1,
        },
        reviewSolicitation: {
          pendingWithoutPositiveFeedback: 1,
          negativeFeedbackWithPendingReview: 1,
        },
        recentAttentionSamples: [
          { id: "engagement-1", guestId: "guest-7", type: "win_back_30", status: "skipped", skipReason: "guest_opted_out_promotional" },
        ],
      },
      campaigns: {
        status: "attention",
        totals: {
          total: 6,
          draft: 1,
          scheduled: 2,
          sent: 3,
          overdueScheduled: 1,
        },
        delivery: {
          sent: 12,
          skipped: 4,
          skippedOptedOut: 2,
          skippedRateLimitedWeek: 1,
          skippedRateLimitedMonth: 1,
        },
        overdueSamples: [
          { id: "campaign-1", restaurantId: "restaurant-1", scheduledAt: "2026-05-27T09:00:00.000Z", name: "May win-back" },
        ],
      },
      outboundMessages: {
        status: "attention",
        statusReasons: [
          "failed_outbound_messages",
          "historical_delivery_errors",
          "owner_whatsapp_config_missing",
        ],
        totals: {
          total: 5,
          logged: 4,
          sent: 0,
          failed: 1,
          skipped: 0,
        },
        byType: {
          daily_morning_summary: 2,
          thank_you: 3,
        },
        byErrorCode: {
          OUTBOUND_RECIPIENT_MISSING: 1,
        },
        byErrorCodeDetails: {
          OUTBOUND_RECIPIENT_MISSING: {
            count: 1,
            firstSeenAt: "2026-05-27T09:00:00.000Z",
            lastSeenAt: "2026-05-27T09:30:00.000Z",
          },
        },
        deliveryReadiness: {
          ownerWhatsappMissing: 2,
          ownerDeliveryRecipientMissing: 0,
          ownerDeliveryFallbackAvailable: 2,
          ownerDeliveryBlocked: false,
          ownerWhatsappConfigOnlyMissing: true,
          ownerWhatsappMissingSamples: [
            {
              restaurantId: "restaurant-1",
              slug: "bff",
              name: "BFF",
              ownerPhoneMasked: "050****12",
              whatsappNumberMasked: "052****34",
            },
          ],
        },
        samples: [
          {
            id: "outbound-1",
            restaurantId: "restaurant-1",
            guestId: null,
            messageType: "daily_morning_summary",
            status: "skipped",
            errorCode: "OUTBOUND_RECIPIENT_MISSING",
          },
        ],
      },
      queues: [
        {
          name: "daily-summary",
          status: "ok",
          failed: 0,
          repeatableJobs: [],
          scheduleHealth: {
            restaurantCount: 9,
            restaurantTimezones: { "Asia/Jerusalem": 9 },
            checks: [
              { name: "daily-morning-summary", expected: 9, found: 9, pattern: "0 9 * * *", status: "ok" },
              { name: "daily-summary", expected: 9, found: 9, pattern: "0 23 * * *", status: "ok" },
            ],
          },
        },
        {
          name: "engagement",
          status: "ok",
          failed: 0,
          repeatableJobs: [],
          scheduleHealth: {
            restaurantCount: 9,
            restaurantTimezones: { "Asia/Jerusalem": 9 },
            checks: [
              { name: "win-back-check", expected: 9, found: 9, pattern: "0 10 * * *", status: "ok" },
              { name: "birthday-check", expected: 9, found: 9, pattern: "0 9 * * *", status: "ok" },
              { name: "anniversary-check", expected: 9, found: 9, pattern: "15 9 * * *", status: "ok" },
              { name: "birthday-week-challenge-check", expected: 9, found: 9, pattern: "30 9 * * *", status: "ok" },
            ],
          },
        },
        { name: "membership-events", status: "ok", failed: 0 },
      ],
      attentionSamples: [
        "membership id=mpf-1 stage=loyalty guest=guest-1 reservation=res-1 error=POINTS_WRITE_FAILED",
        "gamification.stuck-challenge progress=progress-1 guest=guest-2 challenge=challenge-1 value=5/3",
        "campaign.overdue campaign=campaign-1 restaurant=restaurant-1 scheduledAt=2026-05-27T09:00:00.000Z name=May win-back",
        "outbound message=outbound-1 restaurant=restaurant-1 guest=none type=daily_morning_summary status=skipped error=OUTBOUND_RECIPIENT_MISSING",
        "outbound.owner-whatsapp-missing restaurant=restaurant-1 slug=bff name=BFF ownerPhone=050****12 whatsappNumber=052****34",
      ],
    },
    agentMembershipIntents: {
      status: "passed",
      passed: 4,
      total: 4,
    },
    apiLogIssues: {
      status: "attention",
      source: "bundle-run-api-logs",
      outputPath: "/tmp/openseat-debug-bundle/bundle-run-api-logs.txt",
      totalEvents: 8,
      issueEvents: 2,
      expectedIssueEvents: 1,
      unexpectedIssueEvents: 1,
      byLevel: {
        warn: 1,
        error: 1,
      },
      byCode: {
        FST_ERR_REP_ALREADY_SENT: 1,
        AGENT_TOOL_FAILED: 1,
      },
      unexpectedByLevel: {
        error: 1,
      },
      unexpectedByCode: {
        AGENT_TOOL_FAILED: 1,
      },
      samples: [
        "warn debug-package-1 Reply was already sent POST /api/v1/campaigns/audience-preview status=500 errCode=FST_ERR_REP_ALREADY_SENT",
        "error agent-message-1 Agent tool failed POST /api/v1/agent/message status=500 code=AGENT_TOOL_FAILED",
      ],
      unexpectedSamples: [
        "error agent-message-1 Agent tool failed POST /api/v1/agent/message status=500 code=AGENT_TOOL_FAILED",
      ],
    },
    defaultRestaurantSelector: {
      status: "resolved",
      restaurantId: "restaurant-1",
      restaurantSlug: "bff",
      restaurantName: "BFF",
      source: "admin-diagnostics ownerWhatsappMissing sample",
    },
    ownerDeliveryReadiness: {
      status: "ok",
      outputPath: "/tmp/openseat-debug-bundle/owner-delivery-readiness.json",
      requestId: "debug-owner-delivery-restaurants-1",
      totals: {
        restaurants: 9,
        ownerWhatsappConfigured: 7,
        ownerWhatsappMissing: 2,
        ownerDeliveryRecipientConfigured: 8,
        ownerDeliveryRecipientMissing: 1,
        ownerDeliveryFallbackAvailable: 1,
      },
      missingSamples: [
        {
          id: "restaurant-1",
          slug: "bff",
          name: "BFF",
          package: "growth",
          ownerPhoneMasked: "050****12",
          whatsappNumberMasked: "052****34",
          repairCommand: "METHOD=PATCH BODY='{\"ownerWhatsapp\":\"<owner-whatsapp-number>\"}' OPENSEAT_TOKEN=... pnpm debug:api -- http://localhost:3001/api/v1/restaurants/restaurant-1",
        },
      ],
    },
  },
});

const debugBundleManifestOutput = await summarize(debugBundleManifestPath);
assertIncludes(debugBundleManifestOutput, "Type: debug-bundle");
assertIncludes(debugBundleManifestOutput, "Context logs since: 30 minutes ago");
assertIncludes(debugBundleManifestOutput, "Bundle-run logs since: 2026-05-27T12:00:00.000Z");
assertIncludes(debugBundleManifestOutput, "Readiness: ready after 1 attempt(s)");
assertIncludes(debugBundleManifestOutput, "Commands: 3/5 passed");
assertIncludes(debugBundleManifestOutput, "Admin diagnostics: degraded");
assertIncludes(debugBundleManifestOutput, "Running build: abc1234 checkout=abc1234 matches=true");
assertIncludes(debugBundleManifestOutput, "Migration drift: ok code=202605270001 database=202605270001");
assertIncludes(debugBundleManifestOutput, "Membership processing: ok open=2 attempts=3");
assertIncludes(debugBundleManifestOutput, `Membership repair summary: passed output=${membershipDebugSummaryPath}`);
assertIncludes(debugBundleManifestOutput, `Membership engagement jobs: overduePending=2 failed=1 skippedReasons=weekly_promotional_limit_reached:2,guest_opted_out_promotional:1 output=${membershipDebugSummaryPath}`);
assertIncludes(
  debugBundleManifestOutput,
  "Gamification: attention activeChallenges=2 smokeChallenges=1 birthdayWeekActive=1 birthdayWeekDue=1 stuckChallenges=1 duplicateProgress=1 referralCodes=7 referralCreditMismatches=1 menuBadgeGuests=5 achievementGuests=4 achievementMissing=1/1 invalidAchievements=1 leaderboardOptedIn=3 leaderboardRewardMissing=1 invalidLeaderboard=1 streakActive=3 staleStreaks=1 invalidStreaks=1 streakBonusMissing=1",
);
assertIncludes(debugBundleManifestOutput, "Engagement: attention pending=4 overdue=1 failed=1 skipped=3 winBackDue=2 birthdayDue=1 anniversaryDue=1 reviewWithoutPositive=1 negativeWithReview=1");
assertIncludes(debugBundleManifestOutput, "Campaigns: attention total=6 draft=1 scheduled=2 sent=3 overdue=1 deliverySent=12 skipped=4 optedOut=2 weekLimit=1 monthLimit=1");
assertIncludes(debugBundleManifestOutput, `Campaign delivery debug: skippedReasons=guest_opted_out_campaigns: 2,campaign_weekly_limit_reached: 1 overdueSamples=1 output=${queueDebugSummaryPath}`);
assertIncludes(debugBundleManifestOutput, "Outbound messages: attention reasons=failed_outbound_messages,historical_delivery_errors,owner_whatsapp_config_missing total=5 logged=4 sent=0 skipped=0 failed=1 ownerWhatsappMissing=2 ownerDeliveryBlocked=no configOnly=yes types=daily_morning_summary:2,thank_you:3 errors=OUTBOUND_RECIPIENT_MISSING:1[2026-05-27T09:00:00.000Z..2026-05-27T09:30:00.000Z]");
assertIncludes(debugBundleManifestOutput, "Owner delivery readiness: ok total=9 configured=7 missing=2 output=/tmp/openseat-debug-bundle/owner-delivery-readiness.json");
assertIncludes(debugBundleManifestOutput, "Owner delivery recipients: configured=8 missing=1 fallbackAvailable=1");
assertIncludes(debugBundleManifestOutput, "Owner delivery repair samples:");
assertIncludes(debugBundleManifestOutput, "- restaurant-1 slug=bff repair=METHOD=PATCH BODY='{\"ownerWhatsapp\":\"<owner-whatsapp-number>\"}' OPENSEAT_TOKEN=... pnpm debug:api -- http://localhost:3001/api/v1/restaurants/restaurant-1");
assertIncludes(debugBundleManifestOutput, "Agent membership intents: passed 4/4");
assertIncludes(debugBundleManifestOutput, "Bundle-run API logs: attention unexpected=1 expected=1 issues=2/8 levels=warn:1,error:1 codes=FST_ERR_REP_ALREADY_SENT:1,AGENT_TOOL_FAILED:1 output=/tmp/openseat-debug-bundle/bundle-run-api-logs.txt");
assertIncludes(debugBundleManifestOutput, "Bundle-run unexpected API log samples:");
assertIncludes(debugBundleManifestOutput, "- error agent-message-1 Agent tool failed POST /api/v1/agent/message status=500 code=AGENT_TOOL_FAILED");
assertIncludes(debugBundleManifestOutput, 'Default restaurant selector: restaurant-1 slug=bff name="BFF" source=admin-diagnostics ownerWhatsappMissing sample');
assertIncludes(debugBundleManifestOutput, "Queues: daily-summary:ok/failed=0/repeat=0, engagement:ok/failed=0/repeat=0, membership-events:ok/failed=0/repeat=?");
assertIncludes(debugBundleManifestOutput, "Summary schedules: restaurants=9 morning expected=9 found=9 pattern=0 9 * * * status=ok closing expected=9 found=9 pattern=0 23 * * * status=ok timezones=Asia/Jerusalem:9");
assertIncludes(debugBundleManifestOutput, "Engagement schedules: restaurants=9 winBack expected=9 found=9 pattern=0 10 * * * status=ok birthday expected=9 found=9 pattern=0 9 * * * status=ok anniversary expected=9 found=9 pattern=15 9 * * * status=ok birthdayWeek expected=9 found=9 pattern=30 9 * * * status=ok timezones=Asia/Jerusalem:9");
assertIncludes(debugBundleManifestOutput, "Operational attention: Gamification, Engagement, Campaigns, Outbound messages");
assertIncludes(debugBundleManifestOutput, "Attention samples:");
assertIncludes(debugBundleManifestOutput, "- membership id=mpf-1 stage=loyalty guest=guest-1 reservation=res-1 error=POINTS_WRITE_FAILED");
assertIncludes(debugBundleManifestOutput, "- gamification.stuck-challenge progress=progress-1 guest=guest-2 challenge=challenge-1 value=5/3");
assertIncludes(debugBundleManifestOutput, "- campaign.overdue campaign=campaign-1 restaurant=restaurant-1 scheduledAt=2026-05-27T09:00:00.000Z name=May win-back");
assertIncludes(debugBundleManifestOutput, "- outbound message=outbound-1 restaurant=restaurant-1 guest=none type=daily_morning_summary status=skipped error=OUTBOUND_RECIPIENT_MISSING");
assertIncludes(debugBundleManifestOutput, "- outbound.owner-whatsapp-missing restaurant=restaurant-1 slug=bff name=BFF ownerPhone=050****12 whatsappNumber=052****34");
assertIncludes(debugBundleManifestOutput, "Failed commands: 1");
assertIncludes(debugBundleManifestOutput, "- api-smoke: exitCode=1 output=/tmp/openseat-debug-bundle/api-smoke.txt");
assertIncludes(debugBundleManifestOutput, "Skipped commands: 1");
assertIncludes(debugBundleManifestOutput, "- admin-diagnostics: reason=missing token");

const artifactSummarizer = await readFile("scripts/summarize-debug-artifact.mjs", "utf8");
for (const expectedSummarizerContent of [
  "summarizeDebugBundleManifest",
  "Type: debug-bundle",
  "Membership processing",
  "Membership repair summary",
  "Membership engagement jobs",
  "parseMembershipEngagementDebug",
  "skipReason=",
  "Gamification",
  "Engagement",
  "Campaigns",
  "Campaign delivery debug",
  "parseCampaignDeliveryDebug",
  "campaign skipped reasons",
  "Owner delivery readiness",
  "Owner delivery repair samples",
  "Bundle-run API logs",
  "apiLogIssues",
  "Summary schedules",
  "Engagement schedules",
  "Operational attention",
  "operationalAttentionLabels",
  "parseSummaryScheduleHealth",
  "parseEngagementScheduleHealth",
  "formatSummaryScheduleHealthFromDiagnostics",
  "formatEngagementScheduleHealthFromDiagnostics",
  "Agent membership intents",
  "Default restaurant selector",
]) {
  assertIncludes(artifactSummarizer, expectedSummarizerContent);
}

const agentIntentScript = await readFile("scripts/agent-membership-intent-smoke.mjs", "utf8");
for (const expectedProbe of [
  "sanitizeConnectionError",
  "createSignedSuperAdminToken",
  "tokenSource",
  "authorization: `Bearer ${token}`",
  "כמה נקודות יש לי במועדון?",
  "Do I have any reward I can claim?",
  "אפשר קוד חבר מביא חבר?",
  "Please stop sending me club promo messages",
  "Agent membership intent smoke:",
]) {
  assertIncludes(agentIntentScript, expectedProbe);
}

const e2ePath = await writeJson("e2e.json", {
  runId: "e2e-test",
  apiUrl: "http://localhost:3001",
  total: 2,
  passed: 1,
  failed: 1,
  totalMs: 15,
  results: [
    { name: "Health Check", pass: true, detail: "ok", durationMs: 1 },
    {
      name: "Admin Diagnostics",
      pass: true,
      detail: "status=ok matchesBuild=true membershipOpen=0 gamification=ok activeChallenges=6 stuckChallenges=0 referralCreditMismatches=0 engagement=ok engagementPending=4 engagementOverdue=0 engagementFailed=0",
      durationMs: 2,
    },
    { name: "Create Reservation", pass: false, detail: "boom requestId=e2e-request-1", durationMs: 14 },
  ],
});

const e2eOutput = await summarize(e2ePath);
assertIncludes(e2eOutput, "Type: e2e");
assertIncludes(e2eOutput, "Status: 1/2 passed");
assertIncludes(e2eOutput, "Diagnostics:");
assertIncludes(e2eOutput, "Admin Diagnostics: status=ok matchesBuild=true membershipOpen=0 gamification=ok activeChallenges=6");
assertIncludes(e2eOutput, "engagement=ok engagementPending=4 engagementOverdue=0 engagementFailed=0");
assertIncludes(e2eOutput, "- Create Reservation: boom requestId=e2e-request-1");
assertIncludes(e2eOutput, 'pnpm debug:logs e2e-request-1 --since "2 hours ago"');

const e2eRunner = await readFile("apps/e2e/src/test-runner.ts", "utf8");
for (const expectedE2eRunnerContent of [
  "Diagnostics response missing gamification summary",
  "Diagnostics response missing engagement summary",
  "Diagnostics build/checkout mismatch",
  "matchesBuild=${source.checkoutMatchesBuild}",
  "gamification=${gamification.status}",
  "referralCreditMismatches=${gamification.referrals.referrerCreditMismatches}",
  "engagement=${engagement.status}",
]) {
  assertIncludes(e2eRunner, expectedE2eRunnerContent);
}

const e2eApiClient = await readFile("apps/e2e/src/api-client.ts", "utf8");
for (const expectedE2eClientContent of [
  '"x-request-id": requestId',
  "fetch failed requestId=",
  "requestId=${traceId}",
]) {
  assertIncludes(e2eApiClient, expectedE2eClientContent);
}

const bookingWidget = await readFile("apps/booking-widget/src/BookingWidget.tsx", "utf8");
for (const expectedBookingWidgetContent of [
  "createRequestId",
  "parseApiError",
  "WidgetApiError",
  '"x-request-id": requestId',
  "מספר פנייה",
]) {
  assertIncludes(bookingWidget, expectedBookingWidgetContent);
}

const dashboardApiError = await readFile("apps/dashboard/src/lib/apiError.ts", "utf8");
for (const expectedDashboardApiErrorContent of [
  "createRequestId",
  "apiErrorFromFetchFailure",
  "FETCH_FAILED",
  "Network error (request",
  "fallbackRequestId",
  "debugCommand",
  "isApiErrorCode",
]) {
  assertIncludes(dashboardApiError, expectedDashboardApiErrorContent);
}

const dashboardApiHooks = await readFile("apps/dashboard/src/hooks/api.ts", "utf8");
for (const expectedDashboardApiContent of [
  "responseRequestIds",
  '"x-request-id": requestId',
  "apiErrorFromFetchFailure",
  "responseRequestIds.get(res)",
]) {
  assertIncludes(dashboardApiHooks, expectedDashboardApiContent);
}

const dashboardAuth = await readFile("apps/dashboard/src/hooks/useAuth.tsx", "utf8");
for (const expectedDashboardAuthContent of [
  'createRequestId("dashboard-auth")',
  '"x-request-id": requestId',
  "apiErrorFromFetchFailure",
  "apiErrorFromResponse(res, \"POST\", requestId)",
]) {
  assertIncludes(dashboardAuth, expectedDashboardAuthContent);
}

const dashboardLogin = await readFile("apps/dashboard/src/pages/LoginPage.tsx", "utf8");
for (const expectedDashboardLoginContent of [
  "isApiErrorCode",
  "AUTH_INVALID_CREDENTIALS",
  "formatApiErrorMessage",
]) {
  assertIncludes(dashboardLogin, expectedDashboardLoginContent);
}

const dashboardSignup = await readFile("apps/dashboard/src/pages/SignupPage.tsx", "utf8");
for (const expectedDashboardSignupContent of [
  "formatApiErrorMessage",
  "t.signup.validation.submit",
]) {
  assertIncludes(dashboardSignup, expectedDashboardSignupContent);
}

const gamificationRouteEnvelope = await readFile("apps/api/src/routes/gamification.ts", "utf8");
for (const expectedGamificationRouteContent of [
  "gamificationOperationStatusCode",
  "request.log.error(logPayload, \"Gamification operation failed\")",
  "request.log.warn(logPayload, \"Gamification operation rejected\")",
  "return reply.status(statusCode).send",
]) {
  assertIncludes(gamificationRouteEnvelope, expectedGamificationRouteContent);
}

const dashboardChatWidget = await readFile("apps/dashboard/src/components/ChatWidget.tsx", "utf8");
for (const expectedDashboardChatContent of [
  'createRequestId("dashboard-chat")',
  '"x-request-id": requestId',
  "apiErrorFromFetchFailure",
]) {
  assertIncludes(dashboardChatWidget, expectedDashboardChatContent);
}

const deployWorkflow = await readFile(".github/workflows/deploy.yml", "utf8");
const debuggingGuide = await readFile("docs/DEBUGGING.md", "utf8");
for (const requiredDebuggingGuideContent of [
  "tokenSource=jwt_secret",
  "tokenSource=provided",
  "OPENSEAT_RESTAURANT_ID=... pnpm debug:membership",
  "## Outbound Message Trail",
  "pnpm debug:outbound -- --status skipped --message-type daily_morning_summary --limit 5",
  "OUTBOUND_RECIPIENT_MISSING",
  "## Package Enforcement",
  "PACKAGE_GROWTH_REQUIRED",
  "EXPECT_CODE=PACKAGE_GROWTH_REQUIRED",
  "## Queue State",
  "pnpm debug:queues",
  "daily-morning-summary",
  "pattern=0 9 * * *",
]) {
  assertIncludes(debuggingGuide, requiredDebuggingGuideContent);
}

for (const requiredPath of [
  ".github/workflows/deploy.yml",
  "apps/booking-widget/**",
  "apps/dashboard/**",
  "apps/marketing-site/**",
  "packages/**",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "detect-deploy-impact",
  "should-deploy",
  "deploy-dashboard",
  "deploy-marketing",
  "deploy-widget",
  "deploy_dashboard=true",
  "deploy_marketing=true",
  "deploy_widget=true",
]) {
  assertIncludes(deployWorkflow, requiredPath);
}

for (const changedPath of [
  "apps/dashboard/src/App.tsx",
  "apps/booking-widget/src/main.tsx",
  "apps/marketing-site/src/LandingPage.tsx",
  "packages/domain/src/index.ts",
  "pnpm-lock.yaml",
]) {
  assert(deployWorkflowMatches(changedPath), `Expected ${changedPath} to trigger Vercel deploy`);
}

for (const changedPath of [
  "docs/DEBUGGING.md",
  "scripts/api-log-trace.mjs",
  "scripts/summarize-debug-artifact.mjs",
  "apps/e2e/src/test-runner.ts",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy.yml",
  "package.json",
]) {
  assert(!deployWorkflowMatches(changedPath), `Expected ${changedPath} to skip Vercel deploy`);
}

for (const [changedPath, expected] of [
  ["apps/dashboard/src/App.tsx", { dashboard: true, marketing: false, widget: false }],
  ["apps/booking-widget/src/main.tsx", { dashboard: false, marketing: false, widget: true }],
  ["apps/marketing-site/src/LandingPage.tsx", { dashboard: false, marketing: true, widget: false }],
  ["packages/domain/src/index.ts", { dashboard: true, marketing: true, widget: true }],
  [".github/workflows/deploy.yml", { dashboard: false, marketing: false, widget: false }],
]) {
  const actual = deployAppImpacts(changedPath);
  assert(
    actual.dashboard === expected.dashboard
      && actual.marketing === expected.marketing
      && actual.widget === expected.widget,
    `Unexpected deploy app impact for ${changedPath}: ${JSON.stringify(actual)}`,
  );
}

const debugBundleCollector = await readFile("scripts/collect-debug-bundle.mjs", "utf8");
const apiLogTrace = await readFile("scripts/api-log-trace.mjs", "utf8");
const membershipDebugSummary = await readFile("scripts/membership-debug-summary.mjs", "utf8");
const outboundDebugSummary = await readFile("scripts/outbound-debug-summary.mjs", "utf8");
const packageEnforcementSmoke = await readFile("scripts/package-enforcement-smoke.mjs", "utf8");
const ownerDeliveryReadiness = await readFile("scripts/owner-delivery-readiness.mjs", "utf8");
const queueDebugSummary = await readFile("apps/api/scripts/queue-debug-summary.mjs", "utf8");
const diagnosticsService = await readFile("apps/api/src/services/diagnostics.service.ts", "utf8");
const adminRoutes = await readFile("apps/api/src/routes/admin.ts", "utf8");
const restaurantRoutes = await readFile("apps/api/src/routes/restaurants.ts", "utf8");
const authMiddleware = await readFile("apps/api/src/middleware/auth.ts", "utf8");
const campaignRoutes = await readFile("apps/api/src/routes/campaigns.ts", "utf8");
const analyticsRoutes = await readFile("apps/api/src/routes/analytics.ts", "utf8");
const agentRoutes = await readFile("apps/api/src/routes/agent.ts", "utf8");
const engagementRoutes = await readFile("apps/api/src/routes/engagement.ts", "utf8");
const visitsRoutes = await readFile("apps/api/src/routes/visits.ts", "utf8");
const reservationRoutes = await readFile("apps/api/src/routes/reservations.ts", "utf8");
const guestRoutes = await readFile("apps/api/src/routes/guests.ts", "utf8");
const waitlistRoutes = await readFile("apps/api/src/routes/waitlist.ts", "utf8");
const tableRoutes = await readFile("apps/api/src/routes/tables.ts", "utf8");
const engagementService = await readFile("apps/api/src/services/engagement.service.ts", "utf8");
const challengeService = await readFile("apps/api/src/services/challenge.service.ts", "utf8");
const loyaltyRoutes = await readFile("apps/api/src/routes/loyalty.ts", "utf8");
const gamificationRoutes = await readFile("apps/api/src/routes/gamification.ts", "utf8");
const apiReliabilitySmoke = await readFile("scripts/api-reliability-smoke.mjs", "utf8");
const outboundMessageService = await readFile("apps/api/src/services/outbound-message.service.ts", "utf8");
const summaryService = await readFile("apps/api/src/services/summary.service.ts", "utf8");
const debugTokenHelpers = await readFile("scripts/lib/debug-token.mjs", "utf8");
const debugErrorHelpers = await readFile("scripts/lib/debug-errors.mjs", "utf8");
const rootPackageJson = await readFile("package.json", "utf8");
const apiPackageJson = await readFile("apps/api/package.json", "utf8");
assertIncludes(rootPackageJson, '"debug:membership": "node scripts/membership-debug-summary.mjs"');
assertIncludes(rootPackageJson, '"debug:outbound": "node scripts/outbound-debug-summary.mjs"');
assertIncludes(rootPackageJson, '"debug:packages": "node scripts/package-enforcement-smoke.mjs"');
assertIncludes(rootPackageJson, '"debug:owner-delivery": "node scripts/owner-delivery-readiness.mjs"');
assertIncludes(rootPackageJson, '"debug:queues": "pnpm --filter @openseat/api queue:debug"');
assertIncludes(apiPackageJson, '"queue:debug": "node scripts/queue-debug-summary.mjs"');

for (const requiredMembershipDebugContent of [
  "Membership Debug Summary",
  "Processing failures by stage:",
  "Engagement jobs by status:",
  "failuresRequestId=",
  "engagementRequestId=",
  "Overdue pending engagement jobs:",
  "Failed engagement jobs:",
  "ageMinutes=",
  "triggerAt=",
  "engagementJobLine",
  "restaurantLookupRequestId=",
  "restaurantIdSource=",
  "tokenSource=",
  "engagement-limit",
  "engagementUrl.searchParams.set(\"limit\", engagementLimit)",
  "createSignedSuperAdminToken",
  "JWT_SECRET",
  "decodeTokenRestaurantId",
  "OPENSEAT_RESTAURANT_SLUG",
  "pnpm debug:logs",
  "/api/v1/admin/restaurants",
  "/api/v1/loyalty/processing-failures/",
  "/api/v1/engagement/jobs",
]) {
  assertIncludes(membershipDebugSummary, requiredMembershipDebugContent);
}

for (const requiredOutboundDebugContent of [
  "Outbound Message Debug Summary",
  "Outbound messages by status:",
  "Outbound messages by type:",
  "Outbound messages by provider:",
  "Outbound messages by error code:",
  "outboundRequestId=",
  "errorCode=",
  "errorMessage=",
  "restaurantLookupRequestId=",
  "restaurantIdSource=",
  "tokenSource=",
  "createSignedSuperAdminToken",
  "JWT_SECRET",
  "decodeTokenRestaurantId",
  "OPENSEAT_RESTAURANT_SLUG",
  "pnpm debug:logs",
  "/api/v1/admin/restaurants",
  "/api/v1/engagement/outbound-messages",
]) {
  assertIncludes(outboundDebugSummary, requiredOutboundDebugContent);
}

for (const requiredPackageSmokeContent of [
  "Package Enforcement Smoke",
  "/api/v1/admin/restaurants",
  "PACKAGE_GROWTH_REQUIRED",
  "/api/v1/campaigns/audience-preview",
  "/api/v1/analytics/retention",
  "/api/v1/engagement/jobs",
  "/api/v1/loyalty/rewards",
  "/api/v1/gamification/challenges",
  "Package enforcement smoke passed.",
]) {
  assertIncludes(packageEnforcementSmoke, requiredPackageSmokeContent);
}

for (const requiredOwnerDeliveryContent of [
  "Owner Delivery Readiness",
  "/api/v1/admin/restaurants",
  "ownerWhatsappConfigured",
  "ownerWhatsappMissing",
  "ownerDeliveryRecipientConfigured",
  "ownerDeliveryRecipientMissing",
  "ownerDeliveryFallbackAvailable",
  "owner-delivery-readiness",
  "OPENSEAT_OWNER_DELIVERY_ARTIFACT_PATH",
  "OPENSEAT_OWNER_DELIVERY_RESTAURANT_ID",
  "OPENSEAT_OWNER_DELIVERY_OWNER_WHATSAPP",
  "missingRestaurants",
  "repairCommand",
  "patchJson",
  "repair=applied",
  "Repair mode requires --restaurant-id and --owner-whatsapp",
  "artifact-path",
  "owner-whatsapp",
  "ownerPhoneMasked",
  "whatsappNumberMasked",
  "phoneMasked",
  "METHOD=PATCH BODY='{\"ownerWhatsapp\":\"<owner-whatsapp-number>\"}'",
  "/api/v1/restaurants/",
]) {
  assertIncludes(ownerDeliveryReadiness, requiredOwnerDeliveryContent);
}

for (const requiredOutboundServiceContent of [
  "recordOutboundDelivery",
  "OUTBOUND_RECIPIENT_MISSING",
  "byErrorCode",
  "statusReasons",
  "deliveryReadiness",
  "byErrorCodeDetails",
  "firstSeenAt",
  "lastSeenAt",
  "function toIsoString",
  "ownerWhatsappMissing",
  "ownerDeliveryRecipientMissing",
  "ownerDeliveryFallbackAvailable",
  "ownerDeliveryBlocked",
  "ownerWhatsappConfigOnlyMissing",
  "ownerWhatsappMissingSamples",
  "historical_delivery_errors",
  "owner_whatsapp_config_missing",
  "deliveryMode",
  "deliverySkipped",
  "status: missingRequiredRecipient ? \"skipped\" : \"logged\"",
  "case when ${outboundMessages.errorCode} is not null or ${outboundMessages.status} in ('failed', 'skipped') then 0 else 1 end",
]) {
  assertIncludes(outboundMessageService, requiredOutboundServiceContent);
}

for (const requiredSummaryServiceContent of [
  "ownerRecipientConfigured",
  "ownerRecipientSource",
  "ownerWhatsappConfigured: Boolean(restaurant.ownerWhatsapp?.trim())",
  "recipientMasked: maskPhone(match?.value)",
  "resolveOwnerDeliveryContactFromRestaurant",
  "getOwnerDeliveryContact",
  "OWNER_WHATSAPP_MISSING",
]) {
  assertIncludes(summaryService, requiredSummaryServiceContent);
}

for (const requiredQueueDebugContent of [
  "OpenSeat Queue Debug Summary",
  "reservation-reminders",
  "daily-summary",
  "engagement",
  "campaign-delivery",
  "getRepeatableJobs",
  "getJobCounts",
  "getFailed",
  "getDelayed",
  "OPENSEAT_QUEUE_DEBUG_SAMPLE_LIMIT",
  "processedOn",
  "finishedOn",
  "stacktrace.slice(0, 2)",
  "summary schedule health",
  "engagement schedule health",
  "campaign delivery health",
  "campaign skipped reasons",
  "overdue campaign samples",
  "loadCampaignDeliveryContext",
  "skippedRateLimitedWeek",
  "daily-morning-summary",
  "win-back-check",
  "birthday-week-challenge-check",
  "restaurantTimezones",
  "DATABASE_URL not configured",
  "sanitizeConnectionError",
  "sanitizeJobData",
  "[redacted]",
]) {
  assertIncludes(queueDebugSummary, requiredQueueDebugContent);
}

for (const requiredDiagnosticsContent of [
  "scheduleHealth",
  "REPEATABLE_JOB_INSPECT_LIMIT",
  "inspectSummaryScheduleHealth",
  "inspectScheduleHealth",
  "buildScheduleCheck",
  "inspectCampaigns",
  "overdueScheduled",
  "skippedRateLimitedWeek",
  "daily-morning-summary",
  "win-back-check",
  "birthday-week-challenge-check",
  "0 9 * * *",
  "0 10 * * *",
  "30 9 * * *",
  "0 23 * * *",
  "queue.scheduleHealth?.status !== \"attention\"",
  "operationalStatuses.every((sectionStatus) => sectionStatus === \"ok\")",
]) {
  assertIncludes(diagnosticsService, requiredDiagnosticsContent);
}

for (const requiredBirthdayWeekDebugContent of [
  "options: { guestId?: string } = {}",
  "targetGuestId",
  "createdChallengeSamples",
  "skippedExistingSamples",
  "eq(guests.id, options.guestId)",
  "result.createdChallengeSamples.push({ guestId: guest.id, challengeId: created.id })",
  "result.skippedExistingSamples.push({ guestId: guest.id, challengeId: existing.id })",
]) {
  assertIncludes(challengeService, requiredBirthdayWeekDebugContent);
}

for (const requiredBirthdayWeekRouteContent of [
  "guestId?: string",
  "checkBirthdayWeekChallenges(restaurantId, { guestId })",
  "BIRTHDAY_WEEK_CHECK_FAILED",
]) {
  assertIncludes(gamificationRoutes, requiredBirthdayWeekRouteContent);
}

for (const requiredBirthdayWeekSmokeContent of [
  "&guestId=${birthdayChallengeGuestId}",
  "targetGuestId: birthdayWeekCheck.result?.targetGuestId",
  "createdChallengeSamples: birthdayWeekCheck.result?.createdChallengeSamples",
  "skippedExistingSamples: birthdayWeekCheck.result?.skippedExistingSamples",
  "body: { preferences: { birthday: jerusalemMonthDayPlusDays(30) } }",
  "const cleanupBirthday = jerusalemMonthDayPlusDays(30)",
  "body: { preferences: { birthday: cleanupBirthday } }",
]) {
  assertIncludes(apiReliabilitySmoke, requiredBirthdayWeekSmokeContent);
}

assertIncludes(adminRoutes, "return reply.status(200).send({");
assertNotIncludes(adminRoutes, "report.status === \"ok\" ? 200 : 503");

for (const requiredAdminRestaurantContent of [
  "phoneMasked: maskPhone(restaurant.phone)",
  "whatsappNumberMasked: maskPhone(restaurant.whatsappNumber)",
  "ownerPhoneMasked: maskPhone(restaurant.ownerPhone)",
  "ownerWhatsappMasked: maskPhone(restaurant.ownerWhatsapp)",
  "ownerWhatsappConfigured: Boolean(restaurant.ownerWhatsapp?.trim())",
]) {
  assertIncludes(adminRoutes, requiredAdminRestaurantContent);
}

for (const requiredRestaurantPatchContent of [
  "\"whatsappNumber\"",
  "\"ownerPhone\"",
  "\"ownerWhatsapp\"",
  "whatsappNumber: updated.whatsappNumber",
  "ownerPhone: updated.ownerPhone",
  "ownerWhatsapp: updated.ownerWhatsapp",
]) {
  assertIncludes(restaurantRoutes, requiredRestaurantPatchContent);
}

for (const requiredPackageEnforcementContent of [
  "requireGrowthPackage",
  "PackageAccessResult",
  "PACKAGE_GROWTH_REQUIRED",
  "RESTAURANT_NOT_FOUND",
  "restaurant.package !== \"growth\"",
  '{ method: "POST", path: "/api/v1/agent/message" }',
]) {
  assertIncludes(authMiddleware, requiredPackageEnforcementContent);
}
assertNotIncludes(authMiddleware, '{ method: "POST", path: "/api/v1/agent", prefix: true }');

for (const requiredCampaignPackageContent of [
  "enforceCampaignAccess",
  "requireGrowthPackage",
  "requiredPackage: \"growth\"",
  "packageAccess.code === \"RESTAURANT_NOT_FOUND\" ? 404 : 403",
  "PACKAGE_GROWTH_REQUIRED",
  "sendCaughtCampaignError",
  "request.log.error(logPayload, \"Campaign request failed\")",
  "CAMPAIGN_DELIVERY_EVENT_FAILED",
  "if (accessError) return reply;",
  "return true;",
  "return false;",
]) {
  assertIncludes(campaignRoutes, requiredCampaignPackageContent);
}
assertNotIncludes(campaignRoutes, "if (accessError) return accessError;");

for (const requiredAnalyticsPackageContent of [
  "async function enforceAnalyticsAccess",
  "requireGrowthPackage",
  "requiredPackage: \"growth\"",
  "packageAccess.code === \"RESTAURANT_NOT_FOUND\" ? 404 : 403",
  "PACKAGE_GROWTH_REQUIRED",
  "sendCaughtAnalyticsError",
  "request.log.error(logPayload, \"Analytics request failed\")",
  "ANALYTICS_CAMPAIGN_ROI_FAILED",
  "surface: \"retention\"",
  "await enforceAnalyticsAccess",
  "if (accessError) return reply;",
  "return true;",
  "return false;",
]) {
  assertIncludes(analyticsRoutes, requiredAnalyticsPackageContent);
}
assertNotIncludes(analyticsRoutes, "if (accessError) return accessError;");

for (const requiredEngagementPackageContent of [
  "enforceEngagementAccess",
  "requireGrowthPackage",
  "requiredPackage: \"growth\"",
  "packageAccess.code === \"RESTAURANT_NOT_FOUND\" ? 404 : 403",
  "PACKAGE_GROWTH_REQUIRED",
  "await enforceEngagementAccess",
  "if (accessError) return reply;",
  "return true;",
  "return false;",
  "limit?: string",
  "limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined",
  "OUTBOUND_MESSAGES_LIST_FAILED",
  "ENGAGEMENT_JOBS_LIST_FAILED",
  "Outbound message list failed",
  "Engagement job list failed",
  "request.log.error(logPayload, \"Engagement request failed\")",
]) {
  assertIncludes(engagementRoutes, requiredEngagementPackageContent);
}
assertNotIncludes(engagementRoutes, "if (accessError) return accessError;");

for (const requiredEngagementServiceContent of [
  "limit?: number",
  "query.limit(Math.min(Math.max(params.limit, 1), 200))",
]) {
  assertIncludes(engagementService, requiredEngagementServiceContent);
}

for (const requiredVisitRouteContent of [
  "request.log.error(",
  "statusCode: 500",
  "return reply.status(500).send",
  "VISIT_HISTORY_FAILED",
  "VISIT_INSIGHTS_FAILED",
  "FEEDBACK_SUMMARY_FAILED",
  "requestId: request.id",
  "Auto-tag after visit failed",
  "Auto-tag after feedback failed",
]) {
  assertIncludes(visitsRoutes, requiredVisitRouteContent);
}

for (const requiredAgentRouteContent of [
  "classifyAgentError",
  "AGENT_LLM_CONFIG_MISSING",
  "AGENT_LLM_TIMEOUT",
  "AGENT_LLM_REQUEST_FAILED",
  "AGENT_RESET_FAILED",
  "Agent request failed",
  "Agent reset failed",
  "statusCode: classified.statusCode",
  "messageLength: body.message.length",
]) {
  assertIncludes(agentRoutes, requiredAgentRouteContent);
}

for (const requiredLoyaltyPackageContent of [
  "enforceLoyaltyAccess",
  "requireGrowthPackage",
  "requiredPackage: \"growth\"",
  "packageAccess.code === \"RESTAURANT_NOT_FOUND\" ? 404 : 403",
  "PACKAGE_GROWTH_REQUIRED",
  "await enforceLoyaltyAccess",
  "if (accessError) return reply;",
  "return true;",
  "return false;",
  "LOYALTY_OPERATION_FAILED",
  "sendCaughtLoyaltyRouteError",
  "MEMBERSHIP_PROCESSING_LIST_FAILED",
  "LOYALTY_REFERRAL_SHARE_FAILED",
  "LOYALTY_BALANCE_FAILED",
  "LOYALTY_HISTORY_FAILED",
  "MEMBERSHIP_SUMMARY_FAILED",
  "LOYALTY_REWARDS_LIST_FAILED",
  "LOYALTY_CLAIM_VERIFY_FAILED",
  "LOYALTY_MESSAGING_PREFERENCES_FAILED",
  "LOYALTY_STAMP_CARD_FAILED",
  "return sendLoyaltyEnvelopeError(request, reply, 500, message, code, context)",
  "request.log.error(logPayload, \"Loyalty request failed\")",
]) {
  assertIncludes(loyaltyRoutes, requiredLoyaltyPackageContent);
}
assertNotIncludes(loyaltyRoutes, "if (accessError) return accessError;");

for (const requiredReservationRouteContent of [
  "sendCaughtReservationError",
  "RESERVATION_AVAILABILITY_FAILED",
  "RESERVATION_CREATE_FAILED",
  "RESERVATION_WALK_IN_CREATE_FAILED",
  "RESERVATION_LIST_FAILED",
  "RESERVATION_UPDATE_FAILED",
  "RESERVATION_NO_SHOW_FAILED",
  "RESERVATION_CANCEL_FAILED",
  "return sendReservationError(request, reply, 500, message, fallbackCode",
  "request.log.error(logPayload, \"Reservation request failed\")",
]) {
  assertIncludes(reservationRoutes, requiredReservationRouteContent);
}

for (const requiredGuestRouteContent of [
  "sendCaughtGuestError",
  "GUEST_LIST_FAILED",
  "GUEST_LOOKUP_FAILED",
  "GUEST_RESERVATION_HISTORY_FAILED",
  "GUEST_CREATE_FAILED",
  "GUEST_FULL_PROFILE_FAILED",
  "GUEST_SENTIMENT_HISTORY_FAILED",
  "GUEST_AUTO_TAG_FAILED",
  "GUEST_PREFERENCES_UPDATE_FAILED",
  "GUEST_UPDATE_FAILED",
  "request.log.error(logPayload, \"Guest request failed\")",
]) {
  assertIncludes(guestRoutes, requiredGuestRouteContent);
}

for (const requiredWaitlistRouteContent of [
  "sendCaughtWaitlistError",
  "lookupWaitlistRestaurantId",
  "WAITLIST_ADD_FAILED",
  "WAITLIST_LIST_FAILED",
  "WAITLIST_LOOKUP_FAILED",
  "WAITLIST_OFFER_FAILED",
  "WAITLIST_ACCEPT_FAILED",
  "WAITLIST_CANCEL_FAILED",
  "request.log.error(logPayload, \"Waitlist request failed\")",
]) {
  assertIncludes(waitlistRoutes, requiredWaitlistRouteContent);
}

for (const requiredTableRouteContent of [
  "sendCaughtTableError",
  "lookupTableRestaurantId",
  "TABLE_LIST_FAILED",
  "TABLE_CREATE_FAILED",
  "TABLE_LOOKUP_FAILED",
  "TABLE_UPDATE_FAILED",
  "TABLE_DEACTIVATE_FAILED",
  "request.log.error(logPayload, \"Table request failed\")",
]) {
  assertIncludes(tableRoutes, requiredTableRouteContent);
}

for (const requiredGamificationPackageContent of [
  "enforceGamificationAccess",
  "requireGrowthPackage",
  "requiredPackage: \"growth\"",
  "packageAccess.code === \"RESTAURANT_NOT_FOUND\" ? 404 : 403",
  "PACKAGE_GROWTH_REQUIRED",
  "await enforceGamificationAccess",
  "if (accessError) return reply;",
  "return true;",
  "return false;",
]) {
  assertIncludes(gamificationRoutes, requiredGamificationPackageContent);
}
assertNotIncludes(gamificationRoutes, "if (accessError) return accessError;");

for (const requiredLogTraceContent of [
  "parseJsonFromLine",
  "summarizeEvent",
  "Events:",
  "event.req?.method",
  "event.res?.statusCode",
  "status=${statusCode}",
  "code=${event.code}",
  "restaurant=${event.restaurantId}",
]) {
  assertIncludes(apiLogTrace, requiredLogTraceContent);
}

for (const expectedHelper of [
  "sanitizeConnectionError",
  "sanitizeConnectionCause",
]) {
  assertIncludes(debugErrorHelpers, expectedHelper);
}

for (const expectedTokenHelper of [
  "createSignedSuperAdminToken",
  "debug-cli-super-admin@openseat.local",
  "exp: now + 60 * 10",
  "createHmac",
]) {
  assertIncludes(debugTokenHelpers, expectedTokenHelper);
}
assertIncludes(debugBundleCollector, 'import { createSignedSuperAdminToken } from "./lib/debug-token.mjs";');
assertIncludes(debugBundleCollector, 'OPENSEAT_TOKEN: diagnosticsToken.token || process.env.OPENSEAT_TOKEN');
assertIncludes(debugBundleCollector, "statusReasons: outboundMessages.statusReasons");
assertIncludes(debugBundleCollector, "byErrorCodeDetails: outboundMessages.byErrorCodeDetails");
assert(!debugBundleCollector.includes("function createSignedSuperAdminToken()"), "Expected debug bundle to use shared token helper");

for (const requiredReadmeContent of [
  "# OpenSeat Debug Bundle",
  "Readiness:",
  "| Step | Status | File | Notes |",
  "## Highlights",
  "Admin diagnostics:",
  "Running build:",
  "Built at:",
  "Checkout:",
  "matches running build=",
  "Migration drift:",
  "Dependencies: database=",
  "Membership processing:",
  "Gamification:",
  "Engagement:",
  "Outbound messages:",
  "ownerWhatsappMissing=",
  "deliveryReadiness",
  "Agent membership intents:",
  "agent-membership-intents",
  "agent-membership-intents.json",
  "membership-debug-summary",
  "membership-debug-summary.txt",
  "outbound-debug-summary",
  "outbound-debug-summary.txt",
  "owner-delivery-readiness",
  "owner-delivery-readiness.txt",
  "owner-delivery-readiness.json",
  "captureOwnerDeliveryHighlights",
  "Owner delivery readiness:",
  "Owner delivery repair samples:",
  "package-enforcement-smoke",
  "package-enforcement-smoke.txt",
  "queue-debug-summary",
  "queue-debug-summary.txt",
  "scheduleHealth",
  "formatSummaryScheduleHealth",
  "formatEngagementScheduleHealth",
  "OPENSEAT_QUEUE_DEBUG_SAMPLE_LIMIT",
  "OPENSEAT_BUNDLE_RESTAURANT_ID",
  "OPENSEAT_BUNDLE_RESTAURANT_SLUG",
  "OPENSEAT_OUTBOUND_RESTAURANT_ID",
  "OPENSEAT_OUTBOUND_RESTAURANT_SLUG",
  "restaurant-scoped OPENSEAT_TOKEN",
  "decodeTokenRestaurantId",
  "waitForApiReady",
  "resolveBundleRestaurantSelector",
  "defaultRestaurantSelector",
  "restaurantSelectorFromDiagnostics",
  "admin/restaurants first result",
  "OPENSEAT_BUNDLE_READY_TIMEOUT_MS",
  "fail-on-api-log-issues",
  "failOnApiLogIssues",
  "apiLogIssueGate",
  "Queues:",
  "Summary schedules:",
  "Engagement schedules:",
  "Diagnostics request:",
  "## Open First",
  "admin-diagnostics.txt",
  "api-smoke-summary.txt",
  "recent-api-logs.txt",
  "bundle-run-api-logs.txt",
  "captureApiLogIssueHighlights",
  "Bundle-run unexpected API log samples",
  "Bundle-run expected API log samples",
  "expectedBundleLogIssue",
  "Feedback should alert owner",
  "Negative feedback routed to private service recovery",
  "unexpectedIssueEvents",
  "manifest.json",
  "README.md",
  "logWindows",
  "bundleRunSince",
  "highlights: {}",
  "manifest.highlights.adminDiagnostics",
  "gamification",
  "engagement",
  "campaigns",
  "Campaigns:",
  "Operational attention:",
  "Attention samples:",
  "attentionSamples",
  "buildAttentionSamples",
  "pushAttentionSamples",
  "openSamples",
  "recentAttentionSamples",
  "outboundMessages",
  "manifest.highlights.agentMembershipIntents",
  "membershipDebugRestaurantId",
  "membershipDebugRestaurantSlug",
  "readme: readmePath",
]) {
  assertIncludes(debugBundleCollector, requiredReadmeContent);
}

console.log("Debug tool tests passed");
