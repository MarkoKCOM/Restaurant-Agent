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
    { step: "gamification.birthday-week.cleanup", challengeId: "birthday-week-test-1", cleanedCount: 1, isActive: false },
    { step: "engagement.birthday-check", due: 1, scheduled: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "engagement.anniversary-check", due: 1, scheduled: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "engagement.win-back-overdue", scheduled30: 1, skippedExisting: 0, skippedPolicy: 0, jobStatus: "pending" },
    { step: "campaign.audience-preview", matchedCount: 1, matchedWithOptOutCount: 2, excludedOptedOut: 1, hasTargetGuest: true, includesOptedOutByDefault: false, includesOptedOutWhenRequested: true },
    { step: "campaign.creation-scheduling", templateCount: 5, hasWinBackTemplate: true, quietWarning: true, adjusted: true, status: "scheduled", variables: ["guest_name", "days_since_last_visit", "reward_teaser"] },
    { step: "campaign.delivery", firstSent: 1, firstSkippedOptOut: 1, secondSent: 1, thirdSent: 0, thirdSkippedWeek: 1, hasMessagePreview: true, rateLimitedTarget: true },
    { step: "campaign.delivery-events", delivered: 1, read: 1, replied: 1, hasDeliveredAt: true, hasReadAt: true, hasRepliedAt: true },
    { step: "campaign.opt-out-keyword", optedOut: true, llmRounds: 0, deterministicAction: "campaign_opt_out", tool: "set_membership_messaging_opt_out", deliverySent: 0, deliverySkippedOptOut: 2 },
    { step: "analytics.growth-summary", reservationBookings: 12, reservationCovers: 34, reservationSlots: 5, cancellationRate: 0.1, noShowRate: 0.05, retentionUniqueGuests: 4, retentionWindows: [30, 60, 90], activeMembers: 9, pointsIssued: 120, tierBronze: 7, campaigns: 3, campaignSent: 2, hasCampaignRoi: true },
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
assertIncludes(smokeOutput, "gamification.birthday-week.cleanup: active=no cleaned=1 challengeId=birthday-week-test-1");
assertIncludes(smokeOutput, "engagement.birthday-check: due=1 scheduled=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "engagement.anniversary-check: due=1 scheduled=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "engagement.win-back-overdue: scheduled30=1 existing=0 policy=0 status=pending");
assertIncludes(smokeOutput, "campaign.audience-preview: matched=1 withOptOut=2 excludedOptedOut=1 target=yes optedOutDefault=no optedOutRequested=yes");
assertIncludes(smokeOutput, "campaign.creation-scheduling: templates=5 winBack=yes quietWarning=yes adjusted=yes status=scheduled variables=guest_name,days_since_last_visit,reward_teaser");
assertIncludes(smokeOutput, "campaign.delivery: firstSent=1 firstOptOut=1 secondSent=1 thirdSent=0 thirdWeekLimit=1 preview=yes rateLimitedTarget=yes");
assertIncludes(smokeOutput, "campaign.delivery-events: delivered=1 read=1 replied=1 deliveredAt=yes readAt=yes repliedAt=yes");
assertIncludes(smokeOutput, "campaign.opt-out-keyword: optedOut=yes llmRounds=0 action=campaign_opt_out tool=set_membership_messaging_opt_out sent=0 skippedOptOut=2");
assertIncludes(smokeOutput, "analytics.growth-summary: bookings=12 covers=34 slots=5 cancelRate=0.1 noShowRate=0.05 retentionGuests=4 windows=30,60,90 members=9 pointsIssued=120 bronze=7 campaigns=3 sent=2 roi=yes");
assertIncludes(smokeOutput, "Unhandled HTTP failures: 1");
assertIncludes(smokeOutput, "POST /api/v1/reservations -> 500 code=INTERNAL_ERROR requestId=smoke-test-2");
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

const debugBundleManifestPath = await writeJson("manifest.json", {
  createdAt: "2026-05-27T12:00:00.000Z",
  apiUrl: "http://localhost:3001",
  service: "openseat-api",
  since: "30 minutes ago",
  outDir: "/tmp/openseat-debug-bundle",
  readiness: { status: "ready", attempts: 1 },
  commands: [
    { name: "health-probe", status: "passed", outputPath: "/tmp/openseat-debug-bundle/health-probe.txt" },
    { name: "membership-debug-summary", status: "passed", outputPath: "/tmp/openseat-debug-bundle/membership-debug-summary.txt" },
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
      status: "ok",
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
        },
        referrals: {
          guestsWithReferralCode: 7,
          referrerCreditMismatches: 1,
        },
        menuExploration: {
          guestsWithBadges: 5,
        },
        achievements: {
          guestsWithAchievements: 4,
          firstVisitMissing: 1,
          tenVisitMissing: 1,
          invalid: 1,
        },
        leaderboard: {
          optedIn: 3,
          topThreeRewardMissing: 1,
          invalid: 1,
        },
        streaks: {
          active: 3,
          stale: 1,
          invalid: 1,
          milestoneBonusMissing: 1,
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
      },
      queues: [
        { name: "membership-events", status: "ok", failed: 0 },
      ],
    },
    agentMembershipIntents: {
      status: "passed",
      passed: 4,
      total: 4,
    },
  },
});

const debugBundleManifestOutput = await summarize(debugBundleManifestPath);
assertIncludes(debugBundleManifestOutput, "Type: debug-bundle");
assertIncludes(debugBundleManifestOutput, "Readiness: ready after 1 attempt(s)");
assertIncludes(debugBundleManifestOutput, "Commands: 2/4 passed");
assertIncludes(debugBundleManifestOutput, "Running build: abc1234 checkout=abc1234 matches=true");
assertIncludes(debugBundleManifestOutput, "Migration drift: ok code=202605270001 database=202605270001");
assertIncludes(debugBundleManifestOutput, "Membership processing: ok open=2 attempts=3");
assertIncludes(debugBundleManifestOutput, "Membership repair summary: passed output=/tmp/openseat-debug-bundle/membership-debug-summary.txt");
assertIncludes(
  debugBundleManifestOutput,
  "Gamification: attention activeChallenges=2 smokeChallenges=1 birthdayWeekActive=1 birthdayWeekDue=1 stuckChallenges=1 duplicateProgress=1 referralCodes=7 referralCreditMismatches=1 menuBadgeGuests=5 achievementGuests=4 achievementMissing=1/1 invalidAchievements=1 leaderboardOptedIn=3 leaderboardRewardMissing=1 invalidLeaderboard=1 streakActive=3 staleStreaks=1 invalidStreaks=1 streakBonusMissing=1",
);
assertIncludes(debugBundleManifestOutput, "Engagement: attention pending=4 overdue=1 failed=1 skipped=3 winBackDue=2 birthdayDue=1 anniversaryDue=1 reviewWithoutPositive=1 negativeWithReview=1");
assertIncludes(debugBundleManifestOutput, "Agent membership intents: passed 4/4");
assertIncludes(debugBundleManifestOutput, "Queues: membership-events:ok/failed=0");
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
  "Gamification",
  "Engagement",
  "Agent membership intents",
]) {
  assertIncludes(artifactSummarizer, expectedSummarizerContent);
}

const agentIntentScript = await readFile("scripts/agent-membership-intent-smoke.mjs", "utf8");
for (const expectedProbe of [
  "sanitizeConnectionError",
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
]) {
  assertIncludes(dashboardAuth, expectedDashboardAuthContent);
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
const debugErrorHelpers = await readFile("scripts/lib/debug-errors.mjs", "utf8");
const rootPackageJson = await readFile("package.json", "utf8");
assertIncludes(rootPackageJson, '"debug:membership": "node scripts/membership-debug-summary.mjs"');

for (const requiredMembershipDebugContent of [
  "Membership Debug Summary",
  "Processing failures by stage:",
  "Engagement jobs by status:",
  "failuresRequestId=",
  "engagementRequestId=",
  "restaurantLookupRequestId=",
  "restaurantIdSource=",
  "decodeTokenRestaurantId",
  "OPENSEAT_RESTAURANT_SLUG",
  "pnpm debug:logs",
  "/api/v1/admin/restaurants",
  "/api/v1/loyalty/processing-failures/",
  "/api/v1/engagement/jobs",
]) {
  assertIncludes(membershipDebugSummary, requiredMembershipDebugContent);
}

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
  "Agent membership intents:",
  "agent-membership-intents",
  "agent-membership-intents.json",
  "membership-debug-summary",
  "membership-debug-summary.txt",
  "OPENSEAT_BUNDLE_RESTAURANT_ID",
  "OPENSEAT_BUNDLE_RESTAURANT_SLUG",
  "restaurant-scoped OPENSEAT_TOKEN",
  "decodeTokenRestaurantId",
  "waitForApiReady",
  "OPENSEAT_BUNDLE_READY_TIMEOUT_MS",
  "Queues:",
  "Diagnostics request:",
  "## Open First",
  "admin-diagnostics.txt",
  "api-smoke-summary.txt",
  "recent-api-logs.txt",
  "manifest.json",
  "README.md",
  "highlights: {}",
  "manifest.highlights.adminDiagnostics",
  "gamification",
  "engagement",
  "manifest.highlights.agentMembershipIntents",
  "membershipDebugRestaurantId",
  "membershipDebugRestaurantSlug",
  "readme: readmePath",
]) {
  assertIncludes(debugBundleCollector, requiredReadmeContent);
}

console.log("Debug tool tests passed");
