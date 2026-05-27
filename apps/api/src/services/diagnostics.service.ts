import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Redis } from "ioredis";
import type { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { env } from "../env.js";
import { db, pingDatabase } from "../db/index.js";
import { campaignQueue, engagementQueue, reminderQueue, summaryQueue } from "../queue/index.js";
import {
  challengeProgress,
  challenges,
  engagementJobs,
  guests,
  loyaltyTransactions,
  membershipProcessingFailures,
  restaurants,
  visitLogs,
} from "../db/schema.js";
import {
  getRestaurantEngagementQuietHours,
  isDateInEngagementQuietHours,
} from "./engagement.service.js";
import { getOutboundMessageDiagnostics, type OutboundMessageDiagnostics } from "./outbound-message.service.js";

const execFileAsync = promisify(execFile);

export type DiagnosticStatus = "ok" | "error";

export interface DiagnosticCheck {
  status: DiagnosticStatus;
  latencyMs: number;
  error?: {
    name: string;
    code?: string;
    message: string;
  };
}

export interface DiagnosticsReport {
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  environment: {
    nodeEnv: string;
    logLevel: string;
    apiHost: string;
    apiPort: number;
    agentModel: string;
    chatModel: string;
    sentimentModel: string;
    openRouterConfigured: boolean;
  };
  deployment: DeploymentDiagnostic;
  checks: {
    database: DiagnosticCheck;
    redis: DiagnosticCheck;
  };
  queues: QueueDiagnostic[];
  operational: {
    membershipProcessing: MembershipProcessingDiagnostic;
    gamification: GamificationDiagnostic;
    engagement: EngagementDiagnostic;
    outboundMessages: OutboundMessageDiagnostics;
  };
}

export interface DeploymentDiagnostic {
  nodeVersion: string;
  pid: number;
  cwd: string;
  source: {
    status: DiagnosticStatus;
    commit?: string;
    shortCommit?: string;
    branch?: string;
    dirty?: boolean;
    builtAt?: string;
    checkout?: {
      status: DiagnosticStatus;
      commit?: string;
      shortCommit?: string;
      branch?: string;
      dirty?: boolean;
      error?: DiagnosticCheck["error"];
    };
    checkoutMatchesBuild?: boolean;
    error?: DiagnosticCheck["error"];
  };
  codeMigrations: {
    status: DiagnosticStatus;
    count?: number;
    latestFile?: string;
    error?: DiagnosticCheck["error"];
  };
  databaseMigrations: {
    status: DiagnosticStatus;
    count?: number;
    latestId?: number;
    latestHash?: string;
    latestCreatedAt?: number;
    error?: DiagnosticCheck["error"];
  };
  migrationDrift?: {
    status: "ok" | "unknown" | "mismatch";
    codeLatestId?: number;
    databaseLatestId?: number;
    message?: string;
  };
}

export interface QueueDiagnostic {
  name: string;
  status: DiagnosticStatus;
  latencyMs: number;
  counts?: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
  failedSamples?: Array<{
    id: string | number | null;
    name: string;
    attemptsMade: number;
    failedReason?: string;
    timestamp?: number;
    finishedOn?: number;
  }>;
  repeatableJobs?: Array<{
    name: string;
    pattern?: string;
    tz?: string;
    next?: number;
  }>;
  scheduleHealth?: {
    status: "ok" | "attention";
    restaurantCount: number;
    restaurantTimezones: Record<string, number>;
    checks: Array<{
      name: string;
      pattern: string;
      expected: number;
      found: number;
      wrongPattern: number;
      status: "ok" | "attention";
    }>;
  };
  error?: DiagnosticCheck["error"];
}

export interface MembershipProcessingDiagnostic {
  status: "ok" | "attention" | "error";
  openCount?: number;
  totalOpenAttempts?: number;
  latestOpenAttemptAt?: string;
  byStage?: Array<{
    stage: string;
    openCount: number;
    maxAttempts: number;
    latestOpenAttemptAt?: string;
  }>;
  openSamples?: Array<{
    id: string;
    restaurantId: string;
    guestId: string;
    reservationId: string | null;
    stage: string;
    attempts: number;
    errorName: string | null;
    errorCode: string | null;
    errorMessage: string;
    lastAttemptAt: string;
    createdAt: string;
  }>;
  error?: DiagnosticCheck["error"];
}

export interface GamificationDiagnostic {
  status: "ok" | "attention" | "error";
  challenges?: {
    total: number;
    active: number;
    activeSmokeChallenges: number;
    activeBirthdayWeekChallenges: number;
    birthdayWeekDueUncreated: number;
    progressRows: number;
    inProgress: number;
    completed: number;
    stuckCompletions: number;
    duplicateProgressGroups: number;
    stuckSamples: Array<{
      id: string;
      restaurantId: string;
      guestId: string;
      challengeId: string;
      currentValue: number;
      targetValue: number;
      status: string;
    }>;
    duplicateProgressSamples: Array<{
      guestId: string;
      challengeId: string;
      rowCount: number;
    }>;
  };
  referrals?: {
    guestsWithReferralCode: number;
    referredGuests: number;
    referredGuestsWithoutWelcomeBonus: number;
    referrerCreditMismatches: number;
    referrerCreditMismatchSamples: Array<{
      referrerId: string;
      referralCount: number;
      bonusCount: number;
    }>;
  };
  menuExploration?: {
    guestsWithCategories: number;
    guestsWithBadges: number;
    maxCategoryCount: number;
    badgeSamples: Array<{
      guestId: string;
      categoryCount: number;
      badgeCount: number;
    }>;
  };
  achievements?: {
    guestsWithAchievements: number;
    totalBadges: number;
    firstVisitMissing: number;
    tenVisitMissing: number;
    invalid: number;
    samples: Array<{
      guestId: string;
      visitCount: number;
      issue: string;
    }>;
  };
  leaderboard?: {
    optedIn: number;
    currentMonthRanked: number;
    invalid: number;
    topThreeRewardMissing: number;
    samples: Array<{
      guestId: string;
      issue: string;
    }>;
  };
  luckySpin?: {
    awards: number;
    duplicateReservationAwards: number;
    pendingRewardJobs: number;
    samples: Array<{
      guestId: string;
      reservationId: string | null;
      issue: string;
    }>;
  };
  streaks?: {
    guestsWithStreak: number;
    active: number;
    stale: number;
    invalid: number;
    milestoneBonusMissing: number;
    samples: Array<{
      guestId: string;
      current: number | null;
      best: number | null;
      lastVisitWeek: string | null;
      issue: string;
    }>;
  };
  error?: DiagnosticCheck["error"];
}

export interface EngagementDiagnostic {
  status: "ok" | "attention" | "error";
  totals?: {
    total: number;
    pending: number;
    sent: number;
    skipped: number;
    failed: number;
    promotionalPending: number;
    transactionalPending: number;
    overduePending: number;
  };
  winBack?: {
    dueUnscheduled30: number;
    dueUnscheduled60: number;
    dueUnscheduled90: number;
    dueUnscheduledTotal: number;
    samples: Array<{
      guestId: string;
      restaurantId: string;
      lastVisitDate: string;
      dueType: string;
    }>;
  };
  birthdays?: {
    dueUnscheduledToday: number;
    invalidBirthdayCount: number;
    samples: Array<{
      guestId: string;
      restaurantId: string;
      birthday: string;
    }>;
  };
  anniversaries?: {
    dueUnscheduledToday: number;
    samples: Array<{
      guestId: string;
      restaurantId: string;
      firstVisitDate: string;
    }>;
  };
  quietHours?: {
    pendingThankYouInQuietHours: number;
    samples: Array<{
      id: string;
      restaurantId: string;
      guestId: string;
      triggerAt: string;
    }>;
  };
  reviewSolicitation?: {
    pendingWithoutPositiveFeedback: number;
    negativeFeedbackWithPendingReview: number;
    samples: Array<{
      id: string;
      restaurantId: string;
      guestId: string;
      triggerAt: string;
      issue: string;
    }>;
  };
  skippedByReason?: Array<{
    reason: string;
    count: number;
  }>;
  recentAttentionSamples?: Array<{
    id: string;
    restaurantId: string;
    guestId: string;
    type: string;
    status: string;
    messageCategory: string;
    skipReason: string | null;
    triggerAt: string;
    createdAt: string;
  }>;
  error?: DiagnosticCheck["error"];
}

interface BuildInfo {
  commit?: string;
  shortCommit?: string;
  branch?: string;
  dirty?: boolean;
  builtAt?: string;
}

function sanitizeError(error: unknown): DiagnosticCheck["error"] {
  if (error instanceof Error) {
    const maybeCoded = error as Error & { code?: string };
    return {
      name: error.name,
      code: maybeCoded.code,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

async function timedCheck(fn: () => Promise<void>): Promise<DiagnosticCheck> {
  const startedAt = Date.now();

  try {
    await fn();
    return {
      status: "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
    };
  }
}

async function pingRedis(): Promise<void> {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1_000,
    commandTimeout: 1_000,
  });

  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

async function inspectQueue(name: string, queue: Queue): Promise<QueueDiagnostic> {
  const startedAt = Date.now();

  try {
    const [counts, failedJobs, repeatableJobs] = await Promise.all([
      queue.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused"),
      queue.getFailed(0, 2),
      queue.getRepeatableJobs(0, 20),
    ]);

    const normalizedRepeatableJobs = repeatableJobs.map((job) => ({
      name: job.name,
      pattern: job.pattern ?? undefined,
      tz: job.tz ?? undefined,
      next: job.next,
    }));

    const scheduleHealth = name === "daily-summary"
      ? await inspectSummaryScheduleHealth(normalizedRepeatableJobs)
      : undefined;

    return {
      name,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        paused: counts.paused ?? 0,
      },
      failedSamples: failedJobs.map((job) => ({
        id: job.id ?? null,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
      })),
      repeatableJobs: normalizedRepeatableJobs,
      scheduleHealth,
    };
  } catch (error: unknown) {
    return {
      name,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
    };
  }
}

async function inspectSummaryScheduleHealth(
  repeatableJobs: NonNullable<QueueDiagnostic["repeatableJobs"]>,
): Promise<NonNullable<QueueDiagnostic["scheduleHealth"]>> {
  const restaurantRows = await db
    .select({
      timezone: restaurants.timezone,
    })
    .from(restaurants);
  const restaurantCount = restaurantRows.length;
  const restaurantTimezones: Record<string, number> = {};
  for (const restaurant of restaurantRows) {
    const timezone = restaurant.timezone || "Asia/Jerusalem";
    restaurantTimezones[timezone] = (restaurantTimezones[timezone] ?? 0) + 1;
  }

  const checks = [
    buildScheduleCheck(repeatableJobs, "daily-morning-summary", "0 9 * * *", restaurantCount),
    buildScheduleCheck(repeatableJobs, "daily-summary", "0 23 * * *", restaurantCount),
  ];

  return {
    status: checks.every((check) => check.status === "ok") ? "ok" : "attention",
    restaurantCount,
    restaurantTimezones,
    checks,
  };
}

function buildScheduleCheck(
  repeatableJobs: NonNullable<QueueDiagnostic["repeatableJobs"]>,
  name: string,
  pattern: string,
  expected: number,
) {
  const found = repeatableJobs.filter((job) => job.name === name && job.pattern === pattern).length;
  const wrongPattern = repeatableJobs.filter((job) => job.name === name && job.pattern !== pattern).length;
  return {
    name,
    pattern,
    expected,
    found,
    wrongPattern,
    status: found === expected && wrongPattern === 0 ? "ok" as const : "attention" as const,
  };
}

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function inspectMembershipProcessing(): Promise<MembershipProcessingDiagnostic> {
  try {
    const [summaryRows, stageRows, sampleRows] = await Promise.all([
      db.execute(sql`
        select
          count(*)::int as open_count,
          coalesce(sum(attempts), 0)::int as total_open_attempts,
          max(last_attempt_at) as latest_open_attempt_at
        from ${membershipProcessingFailures}
        where status = 'open'
      `) as Promise<Array<{
        open_count: number;
        total_open_attempts: number;
        latest_open_attempt_at: Date | string | null;
      }>>,
      db.execute(sql`
        select
          stage,
          count(*)::int as open_count,
          max(attempts)::int as max_attempts,
          max(last_attempt_at) as latest_open_attempt_at
        from ${membershipProcessingFailures}
        where status = 'open'
        group by stage
        order by open_count desc, stage asc
      `) as Promise<Array<{
        stage: string;
        open_count: number;
        max_attempts: number;
        latest_open_attempt_at: Date | string | null;
      }>>,
      db
        .select({
          id: membershipProcessingFailures.id,
          restaurantId: membershipProcessingFailures.restaurantId,
          guestId: membershipProcessingFailures.guestId,
          reservationId: membershipProcessingFailures.reservationId,
          stage: membershipProcessingFailures.stage,
          attempts: membershipProcessingFailures.attempts,
          errorName: membershipProcessingFailures.errorName,
          errorCode: membershipProcessingFailures.errorCode,
          errorMessage: membershipProcessingFailures.errorMessage,
          lastAttemptAt: membershipProcessingFailures.lastAttemptAt,
          createdAt: membershipProcessingFailures.createdAt,
        })
        .from(membershipProcessingFailures)
        .where(sql`${membershipProcessingFailures.status} = 'open'`)
        .orderBy(sql`${membershipProcessingFailures.createdAt} desc`)
        .limit(5),
    ]);
    const summary = summaryRows[0];
    const openCount = Number(summary?.open_count ?? 0);

    return {
      status: openCount > 0 ? "attention" : "ok",
      openCount,
      totalOpenAttempts: Number(summary?.total_open_attempts ?? 0),
      latestOpenAttemptAt: toIsoString(summary?.latest_open_attempt_at),
      byStage: stageRows.map((row) => ({
        stage: row.stage,
        openCount: Number(row.open_count),
        maxAttempts: Number(row.max_attempts),
        latestOpenAttemptAt: toIsoString(row.latest_open_attempt_at),
      })),
      openSamples: sampleRows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurantId,
        guestId: row.guestId,
        reservationId: row.reservationId,
        stage: row.stage,
        attempts: row.attempts,
        errorName: row.errorName,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        lastAttemptAt: row.lastAttemptAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function inspectGamification(): Promise<GamificationDiagnostic> {
  try {
    const [
      challengeRows,
      progressRows,
      stuckChallengeRows,
      duplicateProgressRows,
      referralRows,
      welcomeBonusRows,
      referrerMismatchRows,
      menuExplorationRows,
      menuExplorationSampleRows,
      achievementRows,
      achievementIssueRows,
      leaderboardRows,
      leaderboardIssueRows,
      luckySpinRows,
      luckySpinIssueRows,
      streakRows,
      streakIssueRows,
      birthdayWeekDueRows,
    ] = await Promise.all([
      db.execute(sql`
        select
          count(*)::int as total_challenges,
          count(*) filter (where is_active = true)::int as active_challenges,
          count(*) filter (
            where is_active = true
              and name like 'Smoke visit challenge %'
          )::int as active_smoke_challenges,
          count(*) filter (
            where is_active = true
              and type = 'birthday_week'
          )::int as active_birthday_week_challenges
        from ${challenges}
      `) as Promise<Array<{
        total_challenges: number;
        active_challenges: number;
        active_smoke_challenges: number;
        active_birthday_week_challenges: number;
      }>>,
      db.execute(sql`
        select
          count(*)::int as progress_rows,
          count(*) filter (where status = 'in_progress')::int as in_progress,
          count(*) filter (where status = 'completed' or completed_at is not null)::int as completed
        from ${challengeProgress}
      `) as Promise<Array<{
        progress_rows: number;
        in_progress: number;
        completed: number;
      }>>,
      db.execute(sql`
        select
          cp.id,
          c.restaurant_id,
          cp.guest_id,
          cp.challenge_id,
          cp.current_value,
          c.target_value,
          cp.status,
          count(*) over()::int as stuck_count
        from ${challengeProgress} cp
        join ${challenges} c on c.id = cp.challenge_id
        where cp.completed_at is null
          and cp.current_value >= c.target_value
        order by cp.current_value - c.target_value desc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        guest_id: string;
        challenge_id: string;
        current_value: number;
        target_value: number;
        status: string;
        stuck_count: number;
      }>>,
      db.execute(sql`
        select
          guest_id,
          challenge_id,
          count(*)::int as row_count,
          count(*) over()::int as duplicate_group_count
        from ${challengeProgress}
        group by guest_id, challenge_id
        having count(*) > 1
        order by row_count desc, guest_id asc, challenge_id asc
        limit 5
      `) as Promise<Array<{
        guest_id: string;
        challenge_id: string;
        row_count: number;
        duplicate_group_count: number;
      }>>,
      db.execute(sql`
        select
          count(*) filter (where referral_code is not null)::int as guests_with_referral_code,
          count(*) filter (where referred_by is not null)::int as referred_guests
        from ${guests}
      `) as Promise<Array<{
        guests_with_referral_code: number;
        referred_guests: number;
      }>>,
      db.execute(sql`
        select count(*)::int as referred_without_welcome_bonus
        from ${guests} g
        where g.referred_by is not null
          and not exists (
            select 1
            from ${loyaltyTransactions} lt
            where lt.guest_id = g.id
              and lt.reason = 'welcome_bonus'
          )
      `) as Promise<Array<{
        referred_without_welcome_bonus: number;
      }>>,
      db.execute(sql`
        with referral_counts as (
          select referred_by as referrer_id, count(*)::int as referral_count
          from ${guests}
          where referred_by is not null
          group by referred_by
        ),
        bonus_counts as (
          select guest_id as referrer_id, count(*)::int as bonus_count
          from ${loyaltyTransactions}
          where reason = 'referral_bonus'
          group by guest_id
        )
        select
          rc.referrer_id,
          rc.referral_count,
          coalesce(bc.bonus_count, 0)::int as bonus_count,
          count(*) over()::int as mismatch_count
        from referral_counts rc
        left join bonus_counts bc on bc.referrer_id = rc.referrer_id
        where coalesce(bc.bonus_count, 0) < rc.referral_count
        order by rc.referral_count - coalesce(bc.bonus_count, 0) desc
        limit 5
      `) as Promise<Array<{
        referrer_id: string;
        referral_count: number;
        bonus_count: number;
        mismatch_count: number;
      }>>,
      db.execute(sql`
        select
          count(*) filter (
            where jsonb_typeof(preferences->'menuExploration'->'categoriesTried') = 'array'
              and jsonb_array_length(preferences->'menuExploration'->'categoriesTried') > 0
          )::int as guests_with_categories,
          count(*) filter (
            where jsonb_typeof(preferences->'menuExploration'->'badges') = 'array'
              and jsonb_array_length(preferences->'menuExploration'->'badges') > 0
          )::int as guests_with_badges,
          coalesce(max(
            case
              when jsonb_typeof(preferences->'menuExploration'->'categoriesTried') = 'array'
              then jsonb_array_length(preferences->'menuExploration'->'categoriesTried')
              else 0
            end
          ), 0)::int as max_category_count
        from ${guests}
      `) as Promise<Array<{
        guests_with_categories: number;
        guests_with_badges: number;
        max_category_count: number;
      }>>,
      db.execute(sql`
        select
          id as guest_id,
          jsonb_array_length(preferences->'menuExploration'->'categoriesTried')::int as category_count,
          jsonb_array_length(preferences->'menuExploration'->'badges')::int as badge_count
        from ${guests}
        where jsonb_typeof(preferences->'menuExploration'->'badges') = 'array'
          and jsonb_array_length(preferences->'menuExploration'->'badges') > 0
        order by badge_count desc, category_count desc
        limit 5
      `) as Promise<Array<{
        guest_id: string;
        category_count: number;
        badge_count: number;
      }>>,
      db.execute(sql`
        with normalized as (
          select
            id,
            visit_count,
            preferences,
            case
              when preferences ? 'achievements'
                and jsonb_typeof(preferences->'achievements'->'badges') = 'array'
              then preferences->'achievements'->'badges'
              else '[]'::jsonb
            end as badges,
            case
              when preferences ? 'achievements'
              then jsonb_typeof(preferences->'achievements'->'badges') = 'array'
              else true
            end as valid
          from ${guests}
        )
        select
          count(*) filter (where jsonb_array_length(badges) > 0)::int as guests_with_achievements,
          coalesce(sum(jsonb_array_length(badges)), 0)::int as total_badges,
          count(*) filter (
            where visit_count >= 1
              and not exists (
                select 1
                from jsonb_array_elements(badges) badge
                where badge->>'key' = 'first_visit'
              )
          )::int as first_visit_missing,
          count(*) filter (
            where visit_count >= 10
              and not exists (
                select 1
                from jsonb_array_elements(badges) badge
                where badge->>'key' = 'ten_visits'
              )
          )::int as ten_visit_missing,
          count(*) filter (where not valid)::int as invalid
        from normalized
      `) as Promise<Array<{
        guests_with_achievements: number;
        total_badges: number;
        first_visit_missing: number;
        ten_visit_missing: number;
        invalid: number;
      }>>,
      db.execute(sql`
        with normalized as (
          select
            id,
            visit_count,
            preferences,
            case
              when preferences ? 'achievements'
                and jsonb_typeof(preferences->'achievements'->'badges') = 'array'
              then preferences->'achievements'->'badges'
              else '[]'::jsonb
            end as badges,
            case
              when preferences ? 'achievements'
              then jsonb_typeof(preferences->'achievements'->'badges') = 'array'
              else true
            end as valid
          from ${guests}
        ),
        issues as (
          select id, visit_count, 'invalid_achievements_preferences' as issue
          from normalized
          where not valid
          union all
          select id, visit_count, 'first_visit_achievement_missing' as issue
          from normalized
          where visit_count >= 1
            and not exists (
              select 1
              from jsonb_array_elements(badges) badge
              where badge->>'key' = 'first_visit'
            )
          union all
          select id, visit_count, 'ten_visits_achievement_missing' as issue
          from normalized
          where visit_count >= 10
            and not exists (
              select 1
              from jsonb_array_elements(badges) badge
              where badge->>'key' = 'ten_visits'
            )
        )
        select *
        from issues
        order by issue asc, visit_count desc
        limit 5
      `) as Promise<Array<{
        id: string;
        visit_count: number;
        issue: string;
      }>>,
      db.execute(sql`
        with opted as (
          select
            id,
            restaurant_id,
            preferences,
            (preferences->'leaderboard'->>'optedIn')::boolean as opted_in
          from ${guests}
          where preferences->'leaderboard'->>'optedIn' = 'true'
        ),
        earned as (
          select
            o.id,
            o.restaurant_id,
            coalesce(sum(lt.points) filter (where lt.type = 'earn'), 0)::int as points_earned
          from opted o
          left join ${loyaltyTransactions} lt on lt.guest_id = o.id
            and lt.restaurant_id = o.restaurant_id
            and lt.created_at >= date_trunc('month', now())
            and lt.created_at < date_trunc('month', now()) + interval '1 month'
          group by o.id, o.restaurant_id
        ),
        ranked as (
          select
            *,
            rank() over (partition by restaurant_id order by points_earned desc, id asc)::int as rank
          from earned
          where points_earned > 0
        ),
        missing_rewards as (
          select r.*
          from ranked r
          where r.rank <= 3
            and not exists (
              select 1
              from ${loyaltyTransactions} lt
              where lt.guest_id = r.id
                and lt.restaurant_id = r.restaurant_id
                and lt.reason = 'leaderboard_monthly:' || to_char(now(), 'YYYY-MM') || ':rank:' || r.rank::text
            )
        )
        select
          (select count(*)::int from opted) as opted_in,
          (select count(*)::int from ranked) as current_month_ranked,
          count(*) filter (
            where preferences ? 'leaderboard'
              and jsonb_typeof(preferences->'leaderboard'->'optedIn') not in ('boolean')
          )::int as invalid,
          (select count(*)::int from missing_rewards) as top_three_reward_missing
        from ${guests}
      `) as Promise<Array<{
        opted_in: number;
        current_month_ranked: number;
        invalid: number;
        top_three_reward_missing: number;
      }>>,
      db.execute(sql`
        with opted as (
          select
            id,
            restaurant_id
          from ${guests}
          where preferences->'leaderboard'->>'optedIn' = 'true'
        ),
        earned as (
          select
            o.id,
            o.restaurant_id,
            coalesce(sum(lt.points) filter (where lt.type = 'earn'), 0)::int as points_earned
          from opted o
          left join ${loyaltyTransactions} lt on lt.guest_id = o.id
            and lt.restaurant_id = o.restaurant_id
            and lt.created_at >= date_trunc('month', now())
            and lt.created_at < date_trunc('month', now()) + interval '1 month'
          group by o.id, o.restaurant_id
        ),
        ranked as (
          select
            *,
            rank() over (partition by restaurant_id order by points_earned desc, id asc)::int as rank
          from earned
          where points_earned > 0
        ),
        issues as (
          select id, 'invalid_leaderboard_preferences' as issue
          from ${guests}
          where preferences ? 'leaderboard'
            and jsonb_typeof(preferences->'leaderboard'->'optedIn') not in ('boolean')
          union all
          select r.id, 'leaderboard_monthly_reward_missing' as issue
          from ranked r
          where r.rank <= 3
            and not exists (
              select 1
              from ${loyaltyTransactions} lt
              where lt.guest_id = r.id
                and lt.restaurant_id = r.restaurant_id
                and lt.reason = 'leaderboard_monthly:' || to_char(now(), 'YYYY-MM') || ':rank:' || r.rank::text
            )
        )
        select *
        from issues
        order by issue asc, id asc
        limit 5
      `) as Promise<Array<{
        id: string;
        issue: string;
      }>>,
      db.execute(sql`
        with duplicate_awards as (
          select guest_id, reservation_id, count(*)::int as award_count
          from ${loyaltyTransactions}
          where reason like 'lucky_spin:%'
            and reservation_id is not null
          group by guest_id, reservation_id
          having count(*) > 1
        )
        select
          (select count(*)::int from ${loyaltyTransactions} where reason like 'lucky_spin:%') as awards,
          (select count(*)::int from duplicate_awards) as duplicate_reservation_awards,
          (
            select count(*)::int
            from ${engagementJobs}
            where type = 'lucky_spin_reward'
              and status = 'pending'
          ) as pending_reward_jobs
      `) as Promise<Array<{
        awards: number;
        duplicate_reservation_awards: number;
        pending_reward_jobs: number;
      }>>,
      db.execute(sql`
        with duplicate_awards as (
          select guest_id, reservation_id, count(*)::int as award_count
          from ${loyaltyTransactions}
          where reason like 'lucky_spin:%'
            and reservation_id is not null
          group by guest_id, reservation_id
          having count(*) > 1
        )
        select guest_id, reservation_id, 'duplicate_lucky_spin_award' as issue
        from duplicate_awards
        order by award_count desc, guest_id asc
        limit 5
      `) as Promise<Array<{
        guest_id: string;
        reservation_id: string | null;
        issue: string;
      }>>,
      db.execute(sql`
        with streak_guests as (
          select
            id,
            preferences->'streak' as streak,
            preferences->'streak'->>'current' as current_text,
            preferences->'streak'->>'best' as best_text,
            preferences->'streak'->>'lastVisitWeek' as last_visit_week
          from ${guests}
          where preferences ? 'streak'
        ),
        normalized as (
          select
            id,
            case when current_text ~ '^\\d+$' then current_text::int end as current_value,
            case when best_text ~ '^\\d+$' then best_text::int end as best_value,
            last_visit_week,
            (
              current_text ~ '^\\d+$'
              and best_text ~ '^\\d+$'
              and coalesce(last_visit_week, '') ~ '^\\d{4}-W\\d{2}$'
            ) as valid
          from streak_guests
        ),
        stale as (
          select *
          from normalized
          where valid
            and current_value >= 3
            and to_date(last_visit_week || '-1', 'IYYY-"W"IW-ID') < current_date - interval '14 days'
        ),
        missing_bonus as (
          select n.*
          from normalized n
          where n.valid
            and n.current_value in (3, 5, 10, 20)
            and not exists (
              select 1
              from ${loyaltyTransactions} lt
              where lt.guest_id = n.id
                and lt.reason = 'streak_milestone:' || n.current_value::text
            )
        )
        select
          (select count(*)::int from streak_guests) as guests_with_streak,
          (select count(*)::int from normalized where valid and current_value > 0) as active,
          (select count(*)::int from stale) as stale,
          (select count(*)::int from normalized where not valid) as invalid,
          (select count(*)::int from missing_bonus) as milestone_bonus_missing
      `) as Promise<Array<{
        guests_with_streak: number;
        active: number;
        stale: number;
        invalid: number;
        milestone_bonus_missing: number;
      }>>,
      db.execute(sql`
        with streak_guests as (
          select
            id,
            preferences->'streak'->>'current' as current_text,
            preferences->'streak'->>'best' as best_text,
            preferences->'streak'->>'lastVisitWeek' as last_visit_week
          from ${guests}
          where preferences ? 'streak'
        ),
        normalized as (
          select
            id,
            case when current_text ~ '^\\d+$' then current_text::int end as current_value,
            case when best_text ~ '^\\d+$' then best_text::int end as best_value,
            last_visit_week,
            (
              current_text ~ '^\\d+$'
              and best_text ~ '^\\d+$'
              and coalesce(last_visit_week, '') ~ '^\\d{4}-W\\d{2}$'
            ) as valid
          from streak_guests
        ),
        issues as (
          select
            id,
            current_value,
            best_value,
            last_visit_week,
            'invalid_streak_preferences' as issue
          from normalized
          where not valid
          union all
          select
            id,
            current_value,
            best_value,
            last_visit_week,
            'stale_active_streak' as issue
          from normalized
          where valid
            and current_value >= 3
            and to_date(last_visit_week || '-1', 'IYYY-"W"IW-ID') < current_date - interval '14 days'
          union all
          select
            n.id,
            n.current_value,
            n.best_value,
            n.last_visit_week,
            'streak_milestone_bonus_missing' as issue
          from normalized n
          where n.valid
            and n.current_value in (3, 5, 10, 20)
            and not exists (
              select 1
              from ${loyaltyTransactions} lt
              where lt.guest_id = n.id
                and lt.reason = 'streak_milestone:' || n.current_value::text
            )
        )
        select *
        from issues
        order by issue asc, current_value desc nulls last
        limit 5
      `) as Promise<Array<{
        id: string;
        current_value: number | null;
        best_value: number | null;
        last_visit_week: string | null;
        issue: string;
      }>>,
      db.execute(sql`
        with birthday_guests as (
          select
            g.id,
            g.restaurant_id,
            case
              when g.preferences ->> 'birthday' ~ '^\\d{4}-\\d{2}-\\d{2}$' then substring(g.preferences ->> 'birthday' from 6 for 5)
              when g.preferences ->> 'birthday' ~ '^\\d{2}-\\d{2}$' then g.preferences ->> 'birthday'
            end as month_day
          from ${guests} g
          where g.preferences ? 'birthday'
        ),
        valid_birthday_guests as (
          select *
          from birthday_guests bg
          where bg.month_day is not null
            and split_part(bg.month_day, '-', 1)::int between 1 and 12
            and split_part(bg.month_day, '-', 2)::int between 1 and extract(day from (
              date_trunc(
                'month',
                make_date(
                  extract(year from now() at time zone 'Asia/Jerusalem')::int,
                  split_part(bg.month_day, '-', 1)::int,
                  1
                )
              ) + interval '1 month - 1 day'
            ))::int
        ),
        due as (
          select
            vbg.id,
            vbg.restaurant_id,
            case
              when make_date(
                extract(year from now() at time zone 'Asia/Jerusalem')::int,
                split_part(vbg.month_day, '-', 1)::int,
                split_part(vbg.month_day, '-', 2)::int
              ) < (now() at time zone 'Asia/Jerusalem')::date
              then make_date(
                extract(year from now() at time zone 'Asia/Jerusalem')::int + 1,
                split_part(vbg.month_day, '-', 1)::int,
                split_part(vbg.month_day, '-', 2)::int
              )
              else make_date(
                extract(year from now() at time zone 'Asia/Jerusalem')::int,
                split_part(vbg.month_day, '-', 1)::int,
                split_part(vbg.month_day, '-', 2)::int
              )
            end as occurrence_date
          from valid_birthday_guests vbg
        ),
        due_window as (
          select *
          from due
          where occurrence_date >= (now() at time zone 'Asia/Jerusalem')::date
            and occurrence_date <= (now() at time zone 'Asia/Jerusalem')::date + interval '7 days'
        ),
        uncreated as (
          select dw.*
          from due_window dw
          where not exists (
            select 1
            from ${challenges} c
            where c.restaurant_id = dw.restaurant_id
              and c.type = 'birthday_week'
              and c.metadata ->> 'source' = 'birthday_week'
              and c.metadata ->> 'guestId' = dw.id::text
              and (c.metadata ->> 'occurrenceYear')::int = extract(year from dw.occurrence_date)::int
          )
        )
        select count(*)::int as birthday_week_due_uncreated
        from uncreated
      `) as Promise<Array<{
        birthday_week_due_uncreated: number;
      }>>,
    ]);
    const challengeSummary = challengeRows[0];
    const progressSummary = progressRows[0];
    const referralSummary = referralRows[0];
    const welcomeBonusSummary = welcomeBonusRows[0];
    const menuExplorationSummary = menuExplorationRows[0];
    const achievementSummary = achievementRows[0];
    const leaderboardSummary = leaderboardRows[0];
    const luckySpinSummary = luckySpinRows[0];
    const streakSummary = streakRows[0];
    const stuckCompletions = Number(stuckChallengeRows[0]?.stuck_count ?? 0);
    const duplicateProgressGroups = Number(duplicateProgressRows[0]?.duplicate_group_count ?? 0);
    const activeSmokeChallenges = Number(challengeSummary?.active_smoke_challenges ?? 0);
    const birthdayWeekDueUncreated = Number(birthdayWeekDueRows[0]?.birthday_week_due_uncreated ?? 0);
    const referredGuestsWithoutWelcomeBonus = Number(welcomeBonusSummary?.referred_without_welcome_bonus ?? 0);
    const referrerCreditMismatches = Number(referrerMismatchRows[0]?.mismatch_count ?? 0);
    const staleStreaks = Number(streakSummary?.stale ?? 0);
    const invalidStreaks = Number(streakSummary?.invalid ?? 0);
    const milestoneBonusMissing = Number(streakSummary?.milestone_bonus_missing ?? 0);
    const firstVisitAchievementMissing = Number(achievementSummary?.first_visit_missing ?? 0);
    const tenVisitAchievementMissing = Number(achievementSummary?.ten_visit_missing ?? 0);
    const invalidAchievements = Number(achievementSummary?.invalid ?? 0);
    const invalidLeaderboard = Number(leaderboardSummary?.invalid ?? 0);
    const topThreeRewardMissing = Number(leaderboardSummary?.top_three_reward_missing ?? 0);
    const duplicateLuckySpinAwards = Number(luckySpinSummary?.duplicate_reservation_awards ?? 0);

    return {
      status: activeSmokeChallenges > 0 || stuckCompletions > 0 || duplicateProgressGroups > 0 || referredGuestsWithoutWelcomeBonus > 0 || referrerCreditMismatches > 0 || birthdayWeekDueUncreated > 0 || staleStreaks > 0 || invalidStreaks > 0 || milestoneBonusMissing > 0 || firstVisitAchievementMissing > 0 || tenVisitAchievementMissing > 0 || invalidAchievements > 0 || invalidLeaderboard > 0 || topThreeRewardMissing > 0 || duplicateLuckySpinAwards > 0
        ? "attention"
        : "ok",
      challenges: {
        total: Number(challengeSummary?.total_challenges ?? 0),
        active: Number(challengeSummary?.active_challenges ?? 0),
        activeSmokeChallenges,
        activeBirthdayWeekChallenges: Number(challengeSummary?.active_birthday_week_challenges ?? 0),
        birthdayWeekDueUncreated,
        progressRows: Number(progressSummary?.progress_rows ?? 0),
        inProgress: Number(progressSummary?.in_progress ?? 0),
        completed: Number(progressSummary?.completed ?? 0),
        stuckCompletions,
        duplicateProgressGroups,
        stuckSamples: stuckChallengeRows.map((row) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          guestId: row.guest_id,
          challengeId: row.challenge_id,
          currentValue: Number(row.current_value),
          targetValue: Number(row.target_value),
          status: row.status,
        })),
        duplicateProgressSamples: duplicateProgressRows.map((row) => ({
          guestId: row.guest_id,
          challengeId: row.challenge_id,
          rowCount: Number(row.row_count),
        })),
      },
      referrals: {
        guestsWithReferralCode: Number(referralSummary?.guests_with_referral_code ?? 0),
        referredGuests: Number(referralSummary?.referred_guests ?? 0),
        referredGuestsWithoutWelcomeBonus,
        referrerCreditMismatches,
        referrerCreditMismatchSamples: referrerMismatchRows.map((row) => ({
          referrerId: row.referrer_id,
          referralCount: Number(row.referral_count),
          bonusCount: Number(row.bonus_count),
        })),
      },
      menuExploration: {
        guestsWithCategories: Number(menuExplorationSummary?.guests_with_categories ?? 0),
        guestsWithBadges: Number(menuExplorationSummary?.guests_with_badges ?? 0),
        maxCategoryCount: Number(menuExplorationSummary?.max_category_count ?? 0),
        badgeSamples: menuExplorationSampleRows.map((row) => ({
          guestId: row.guest_id,
          categoryCount: Number(row.category_count),
          badgeCount: Number(row.badge_count),
        })),
      },
      achievements: {
        guestsWithAchievements: Number(achievementSummary?.guests_with_achievements ?? 0),
        totalBadges: Number(achievementSummary?.total_badges ?? 0),
        firstVisitMissing: firstVisitAchievementMissing,
        tenVisitMissing: tenVisitAchievementMissing,
        invalid: invalidAchievements,
        samples: achievementIssueRows.map((row) => ({
          guestId: row.id,
          visitCount: Number(row.visit_count),
          issue: row.issue,
        })),
      },
      leaderboard: {
        optedIn: Number(leaderboardSummary?.opted_in ?? 0),
        currentMonthRanked: Number(leaderboardSummary?.current_month_ranked ?? 0),
        invalid: invalidLeaderboard,
        topThreeRewardMissing,
        samples: leaderboardIssueRows.map((row) => ({
          guestId: row.id,
          issue: row.issue,
        })),
      },
      luckySpin: {
        awards: Number(luckySpinSummary?.awards ?? 0),
        duplicateReservationAwards: duplicateLuckySpinAwards,
        pendingRewardJobs: Number(luckySpinSummary?.pending_reward_jobs ?? 0),
        samples: luckySpinIssueRows.map((row) => ({
          guestId: row.guest_id,
          reservationId: row.reservation_id,
          issue: row.issue,
        })),
      },
      streaks: {
        guestsWithStreak: Number(streakSummary?.guests_with_streak ?? 0),
        active: Number(streakSummary?.active ?? 0),
        stale: staleStreaks,
        invalid: invalidStreaks,
        milestoneBonusMissing,
        samples: streakIssueRows.map((row) => ({
          guestId: row.id,
          current: row.current_value === null ? null : Number(row.current_value),
          best: row.best_value === null ? null : Number(row.best_value),
          lastVisitWeek: row.last_visit_week,
          issue: row.issue,
        })),
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function inspectEngagement(): Promise<EngagementDiagnostic> {
  try {
    const [summaryRows, skippedRows, sampleRows, winBackRows, winBackSampleRows, birthdayRows, birthdaySampleRows, anniversaryRows, anniversarySampleRows, pendingThankYouRows, reviewWithoutPositiveRows, negativeWithPendingReviewRows] = await Promise.all([
      db.execute(sql`
        select
          count(*)::int as total,
          count(*) filter (where status = 'pending')::int as pending,
          count(*) filter (where status = 'sent')::int as sent,
          count(*) filter (where status = 'skipped')::int as skipped,
          count(*) filter (where status = 'failed')::int as failed,
          count(*) filter (where status = 'pending' and message_category = 'promotional')::int as promotional_pending,
          count(*) filter (where status = 'pending' and message_category = 'transactional')::int as transactional_pending,
          count(*) filter (where status = 'pending' and trigger_at < now() - interval '15 minutes')::int as overdue_pending
        from ${engagementJobs}
      `) as Promise<Array<{
        total: number;
        pending: number;
        sent: number;
        skipped: number;
        failed: number;
        promotional_pending: number;
        transactional_pending: number;
        overdue_pending: number;
      }>>,
      db.execute(sql`
        select coalesce(skip_reason, 'unknown') as reason, count(*)::int as count
        from ${engagementJobs}
        where status = 'skipped'
        group by coalesce(skip_reason, 'unknown')
        order by count desc, reason asc
        limit 5
      `) as Promise<Array<{
        reason: string;
        count: number;
      }>>,
      db.execute(sql`
        select
          id,
          restaurant_id,
          guest_id,
          type,
          status,
          message_category,
          skip_reason,
          trigger_at,
          created_at
        from ${engagementJobs}
        where status = 'failed'
          or (status = 'pending' and trigger_at < now() - interval '15 minutes')
        order by trigger_at asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        guest_id: string;
        type: string;
        status: string;
        message_category: string;
        skip_reason: string | null;
        trigger_at: Date | string;
        created_at: Date | string;
      }>>,
      db.execute(sql`
        with due as (
          select
            g.id,
            g.restaurant_id,
            g.last_visit_date,
            case
              when g.last_visit_date <= current_date - interval '90 days' then 'win_back_90'
              when g.last_visit_date <= current_date - interval '60 days' then 'win_back_60'
              when g.last_visit_date <= current_date - interval '30 days' then 'win_back_30'
            end as due_type
          from ${guests} g
          where g.last_visit_date is not null
            and g.last_visit_date <= current_date - interval '30 days'
        ),
        unscheduled as (
          select d.*
          from due d
          where d.due_type is not null
            and not exists (
              select 1
              from ${engagementJobs} ej
              where ej.guest_id = d.id
                and ej.restaurant_id = d.restaurant_id
                and ej.type = d.due_type
            )
        )
        select
          count(*) filter (where due_type = 'win_back_30')::int as due_unscheduled_30,
          count(*) filter (where due_type = 'win_back_60')::int as due_unscheduled_60,
          count(*) filter (where due_type = 'win_back_90')::int as due_unscheduled_90,
          count(*)::int as due_unscheduled_total
        from unscheduled
      `) as Promise<Array<{
        due_unscheduled_30: number;
        due_unscheduled_60: number;
        due_unscheduled_90: number;
        due_unscheduled_total: number;
      }>>,
      db.execute(sql`
        with due as (
          select
            g.id,
            g.restaurant_id,
            g.last_visit_date,
            case
              when g.last_visit_date <= current_date - interval '90 days' then 'win_back_90'
              when g.last_visit_date <= current_date - interval '60 days' then 'win_back_60'
              when g.last_visit_date <= current_date - interval '30 days' then 'win_back_30'
            end as due_type
          from ${guests} g
          where g.last_visit_date is not null
            and g.last_visit_date <= current_date - interval '30 days'
        )
        select d.id, d.restaurant_id, d.last_visit_date, d.due_type
        from due d
        where d.due_type is not null
          and not exists (
            select 1
            from ${engagementJobs} ej
            where ej.guest_id = d.id
              and ej.restaurant_id = d.restaurant_id
              and ej.type = d.due_type
          )
        order by d.last_visit_date asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        last_visit_date: string;
        due_type: string;
      }>>,
      db.execute(sql`
        with birthday_guests as (
          select
            g.id,
            g.restaurant_id,
            g.preferences ->> 'birthday' as birthday,
            case
              when g.preferences ->> 'birthday' ~ '^\\d{4}-\\d{2}-\\d{2}$' then substring(g.preferences ->> 'birthday' from 6 for 5)
              when g.preferences ->> 'birthday' ~ '^\\d{2}-\\d{2}$' then g.preferences ->> 'birthday'
            end as month_day
          from ${guests} g
          where g.preferences ? 'birthday'
        ),
        due as (
          select *
          from birthday_guests
          where month_day = to_char(now() at time zone 'Asia/Jerusalem', 'MM-DD')
        ),
        unscheduled as (
          select d.*
          from due d
          where not exists (
            select 1
            from ${engagementJobs} ej
            where ej.guest_id = d.id
              and ej.restaurant_id = d.restaurant_id
              and ej.type = 'birthday'
              and ej.trigger_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
              and ej.trigger_at < (date_trunc('day', now() at time zone 'Asia/Jerusalem') + interval '1 day') at time zone 'Asia/Jerusalem'
          )
        )
        select
          (select count(*)::int from unscheduled) as due_unscheduled_today,
          (select count(*)::int from birthday_guests where birthday is not null and month_day is null) as invalid_birthday_count
      `) as Promise<Array<{
        due_unscheduled_today: number;
        invalid_birthday_count: number;
      }>>,
      db.execute(sql`
        with birthday_guests as (
          select
            g.id,
            g.restaurant_id,
            g.preferences ->> 'birthday' as birthday,
            case
              when g.preferences ->> 'birthday' ~ '^\\d{4}-\\d{2}-\\d{2}$' then substring(g.preferences ->> 'birthday' from 6 for 5)
              when g.preferences ->> 'birthday' ~ '^\\d{2}-\\d{2}$' then g.preferences ->> 'birthday'
            end as month_day
          from ${guests} g
          where g.preferences ? 'birthday'
        ),
        due as (
          select *
          from birthday_guests
          where month_day = to_char(now() at time zone 'Asia/Jerusalem', 'MM-DD')
        )
        select d.id, d.restaurant_id, d.birthday
        from due d
        where not exists (
          select 1
          from ${engagementJobs} ej
          where ej.guest_id = d.id
            and ej.restaurant_id = d.restaurant_id
            and ej.type = 'birthday'
            and ej.trigger_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
            and ej.trigger_at < (date_trunc('day', now() at time zone 'Asia/Jerusalem') + interval '1 day') at time zone 'Asia/Jerusalem'
        )
        order by d.restaurant_id asc, d.id asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        birthday: string;
      }>>,
      db.execute(sql`
        with due as (
          select g.id, g.restaurant_id, g.first_visit_date
          from ${guests} g
          where g.first_visit_date is not null
            and to_char(g.first_visit_date::date, 'MM-DD') = to_char(now() at time zone 'Asia/Jerusalem', 'MM-DD')
            and extract(year from g.first_visit_date::date)::int < extract(year from now() at time zone 'Asia/Jerusalem')::int
        ),
        unscheduled as (
          select d.*
          from due d
          where not exists (
            select 1
            from ${engagementJobs} ej
            where ej.guest_id = d.id
              and ej.restaurant_id = d.restaurant_id
              and ej.type = 'anniversary'
              and ej.trigger_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
              and ej.trigger_at < (date_trunc('day', now() at time zone 'Asia/Jerusalem') + interval '1 day') at time zone 'Asia/Jerusalem'
          )
        )
        select count(*)::int as due_unscheduled_today
        from unscheduled
      `) as Promise<Array<{
        due_unscheduled_today: number;
      }>>,
      db.execute(sql`
        with due as (
          select g.id, g.restaurant_id, g.first_visit_date
          from ${guests} g
          where g.first_visit_date is not null
            and to_char(g.first_visit_date::date, 'MM-DD') = to_char(now() at time zone 'Asia/Jerusalem', 'MM-DD')
            and extract(year from g.first_visit_date::date)::int < extract(year from now() at time zone 'Asia/Jerusalem')::int
        )
        select d.id, d.restaurant_id, d.first_visit_date
        from due d
        where not exists (
          select 1
          from ${engagementJobs} ej
          where ej.guest_id = d.id
            and ej.restaurant_id = d.restaurant_id
            and ej.type = 'anniversary'
            and ej.trigger_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
            and ej.trigger_at < (date_trunc('day', now() at time zone 'Asia/Jerusalem') + interval '1 day') at time zone 'Asia/Jerusalem'
        )
        order by d.restaurant_id asc, d.id asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        first_visit_date: string;
      }>>,
      db.execute(sql`
        select
          ej.id,
          ej.restaurant_id,
          ej.guest_id,
          ej.trigger_at
        from ${engagementJobs} ej
        inner join ${restaurants} r on r.id = ej.restaurant_id
        where ej.status = 'pending'
          and ej.type = 'thank_you'
          and ej.trigger_at >= now() - interval '1 day'
          and ej.created_at >= r.updated_at - interval '5 seconds'
        order by ej.trigger_at asc
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        guest_id: string;
        trigger_at: Date | string;
      }>>,
      db.execute(sql`
        select
          ej.id,
          ej.restaurant_id,
          ej.guest_id,
          ej.trigger_at,
          count(*) over()::int as issue_count
        from ${engagementJobs} ej
        where ej.status = 'pending'
          and ej.type = 'review_request'
          and not exists (
            select 1
            from ${visitLogs} vl
            where vl.restaurant_id = ej.restaurant_id
              and vl.guest_id = ej.guest_id
              and vl.sentiment = 'positive'
          )
        order by ej.trigger_at asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        guest_id: string;
        trigger_at: Date | string;
        issue_count: number;
      }>>,
      db.execute(sql`
        select
          ej.id,
          ej.restaurant_id,
          ej.guest_id,
          ej.trigger_at,
          count(*) over()::int as issue_count
        from ${engagementJobs} ej
        where ej.status = 'pending'
          and ej.type = 'review_request'
          and exists (
            select 1
            from ${visitLogs} vl
            where vl.restaurant_id = ej.restaurant_id
              and vl.guest_id = ej.guest_id
              and vl.sentiment = 'negative'
          )
        order by ej.trigger_at asc
        limit 5
      `) as Promise<Array<{
        id: string;
        restaurant_id: string;
        guest_id: string;
        trigger_at: Date | string;
        issue_count: number;
      }>>,
    ]);
    const summary = summaryRows[0];
    const winBackSummary = winBackRows[0];
    const birthdaySummary = birthdayRows[0];
    const anniversarySummary = anniversaryRows[0];
    const failed = Number(summary?.failed ?? 0);
    const overduePending = Number(summary?.overdue_pending ?? 0);
    const dueUnscheduledTotal = Number(winBackSummary?.due_unscheduled_total ?? 0);
    const birthdayDueUnscheduledToday = Number(birthdaySummary?.due_unscheduled_today ?? 0);
    const anniversaryDueUnscheduledToday = Number(anniversarySummary?.due_unscheduled_today ?? 0);
    const quietHourSamples: NonNullable<EngagementDiagnostic["quietHours"]>["samples"] = [];
    const quietHoursByRestaurant = new Map<string, Awaited<ReturnType<typeof getRestaurantEngagementQuietHours>>>();

    for (const row of pendingThankYouRows) {
      const triggerAt = row.trigger_at instanceof Date ? row.trigger_at : new Date(row.trigger_at);
      let config = quietHoursByRestaurant.get(row.restaurant_id);
      if (!config) {
        config = await getRestaurantEngagementQuietHours(row.restaurant_id);
        quietHoursByRestaurant.set(row.restaurant_id, config);
      }

      if (isDateInEngagementQuietHours(triggerAt, config.timeZone, config.quietHours)) {
        quietHourSamples.push({
          id: row.id,
          restaurantId: row.restaurant_id,
          guestId: row.guest_id,
          triggerAt: triggerAt.toISOString(),
        });
      }
    }
    const pendingThankYouInQuietHours = quietHourSamples.length;
    const pendingReviewWithoutPositive = Number(reviewWithoutPositiveRows[0]?.issue_count ?? 0);
    const negativeFeedbackWithPendingReview = Number(negativeWithPendingReviewRows[0]?.issue_count ?? 0);
    const reviewSolicitationSamples = [
      ...reviewWithoutPositiveRows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        guestId: row.guest_id,
        triggerAt: toIsoString(row.trigger_at) ?? "",
        issue: "pending_review_without_positive_feedback",
      })),
      ...negativeWithPendingReviewRows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        guestId: row.guest_id,
        triggerAt: toIsoString(row.trigger_at) ?? "",
        issue: "negative_feedback_with_pending_review",
      })),
    ].slice(0, 5);

    return {
      status: failed > 0 || overduePending > 0 || dueUnscheduledTotal > 0 || birthdayDueUnscheduledToday > 0 || anniversaryDueUnscheduledToday > 0 || pendingThankYouInQuietHours > 0 || pendingReviewWithoutPositive > 0 || negativeFeedbackWithPendingReview > 0 ? "attention" : "ok",
      totals: {
        total: Number(summary?.total ?? 0),
        pending: Number(summary?.pending ?? 0),
        sent: Number(summary?.sent ?? 0),
        skipped: Number(summary?.skipped ?? 0),
        failed,
        promotionalPending: Number(summary?.promotional_pending ?? 0),
        transactionalPending: Number(summary?.transactional_pending ?? 0),
        overduePending,
      },
      winBack: {
        dueUnscheduled30: Number(winBackSummary?.due_unscheduled_30 ?? 0),
        dueUnscheduled60: Number(winBackSummary?.due_unscheduled_60 ?? 0),
        dueUnscheduled90: Number(winBackSummary?.due_unscheduled_90 ?? 0),
        dueUnscheduledTotal,
        samples: winBackSampleRows.map((row) => ({
          guestId: row.id,
          restaurantId: row.restaurant_id,
          lastVisitDate: String(row.last_visit_date),
          dueType: row.due_type,
        })),
      },
      birthdays: {
        dueUnscheduledToday: birthdayDueUnscheduledToday,
        invalidBirthdayCount: Number(birthdaySummary?.invalid_birthday_count ?? 0),
        samples: birthdaySampleRows.map((row) => ({
          guestId: row.id,
          restaurantId: row.restaurant_id,
          birthday: row.birthday,
        })),
      },
      anniversaries: {
        dueUnscheduledToday: anniversaryDueUnscheduledToday,
        samples: anniversarySampleRows.map((row) => ({
          guestId: row.id,
          restaurantId: row.restaurant_id,
          firstVisitDate: String(row.first_visit_date),
        })),
      },
      quietHours: {
        pendingThankYouInQuietHours,
        samples: quietHourSamples.slice(0, 5),
      },
      reviewSolicitation: {
        pendingWithoutPositiveFeedback: pendingReviewWithoutPositive,
        negativeFeedbackWithPendingReview,
        samples: reviewSolicitationSamples,
      },
      skippedByReason: skippedRows.map((row) => ({
        reason: row.reason,
        count: Number(row.count),
      })),
      recentAttentionSamples: sampleRows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        guestId: row.guest_id,
        type: row.type,
        status: row.status,
        messageCategory: row.message_category,
        skipReason: row.skip_reason,
        triggerAt: toIsoString(row.trigger_at) ?? "",
        createdAt: toIsoString(row.created_at) ?? "",
      })),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

function parseMigrationFileId(fileName: string): number | undefined {
  const match = fileName.match(/^(\d+)_.*\.sql$/);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

async function inspectCodeMigrations(): Promise<DeploymentDiagnostic["codeMigrations"]> {
  try {
    const files = (await readdir(join(process.cwd(), "drizzle")))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();

    return {
      status: "ok",
      count: files.length,
      latestFile: files.at(-1),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function inspectDatabaseMigrations(): Promise<DeploymentDiagnostic["databaseMigrations"]> {
  try {
    const rows = await db.execute(sql`
      select
        count(*)::int as count,
        max(id)::int as latest_id,
        (
          select hash
          from drizzle.__drizzle_migrations
          order by id desc
          limit 1
        ) as latest_hash,
        (
          select created_at
          from drizzle.__drizzle_migrations
          order by id desc
          limit 1
        )::bigint as latest_created_at
      from drizzle.__drizzle_migrations
    `) as Array<{
      count: number;
      latest_id: number | null;
      latest_hash: string | null;
      latest_created_at: number | null;
    }>;
    const row = rows[0];

    return {
      status: "ok",
      count: Number(row?.count ?? 0),
      latestId: row?.latest_id ?? undefined,
      latestHash: row?.latest_hash ?? undefined,
      latestCreatedAt: row?.latest_created_at === null || row?.latest_created_at === undefined
        ? undefined
        : Number(row.latest_created_at),
    };
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 1_000,
    maxBuffer: 64 * 1024,
  });

  return stdout.trim();
}

async function inspectSourceRevision(): Promise<DeploymentDiagnostic["source"]> {
  let buildInfo: BuildInfo;

  try {
    buildInfo = JSON.parse(
      await readFile(new URL("../build-info.json", import.meta.url), "utf8"),
    ) as BuildInfo;
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }

  try {
    const [commit, branch, status] = await Promise.all([
      runGit(["rev-parse", "HEAD"]),
      runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
      runGit(["status", "--porcelain"]),
    ]);
    const checkout = {
      status: "ok" as const,
      commit,
      shortCommit: commit.slice(0, 12),
      branch,
      dirty: status.length > 0,
    };

    return {
      status: "ok",
      commit: buildInfo.commit,
      shortCommit: buildInfo.shortCommit ?? buildInfo.commit?.slice(0, 12),
      branch: buildInfo.branch,
      dirty: buildInfo.dirty,
      builtAt: buildInfo.builtAt,
      checkout,
      checkoutMatchesBuild: Boolean(buildInfo.commit && buildInfo.commit === checkout.commit),
    };
  } catch (error: unknown) {
    return {
      status: "ok",
      commit: buildInfo.commit,
      shortCommit: buildInfo.shortCommit ?? buildInfo.commit?.slice(0, 12),
      branch: buildInfo.branch,
      dirty: buildInfo.dirty,
      builtAt: buildInfo.builtAt,
      checkout: {
        status: "error",
        error: sanitizeError(error),
      },
    };
  }
}

async function inspectDeployment(): Promise<DeploymentDiagnostic> {
  const [source, codeMigrations, databaseMigrations] = await Promise.all([
    inspectSourceRevision(),
    inspectCodeMigrations(),
    inspectDatabaseMigrations(),
  ]);
  const codeLatestId = codeMigrations.latestFile
    ? parseMigrationFileId(codeMigrations.latestFile)
    : undefined;
  const databaseLatestId = databaseMigrations.latestId;
  const migrationDrift: DeploymentDiagnostic["migrationDrift"] =
    codeLatestId === undefined || databaseLatestId === undefined
      ? {
          status: "unknown",
          codeLatestId,
          databaseLatestId,
          message: "Migration drift could not be evaluated",
        }
      : codeLatestId === databaseLatestId
        ? { status: "ok", codeLatestId, databaseLatestId }
        : {
            status: "mismatch",
            codeLatestId,
            databaseLatestId,
            message: "Latest code migration does not match latest applied database migration",
          };

  return {
    nodeVersion: process.version,
    pid: process.pid,
    cwd: process.cwd(),
    source,
    codeMigrations,
    databaseMigrations,
    migrationDrift,
  };
}

async function inspectOutboundMessages(): Promise<OutboundMessageDiagnostics> {
  try {
    return await getOutboundMessageDiagnostics();
  } catch (error: unknown) {
    return {
      status: "error",
      error: sanitizeError(error),
    };
  }
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [database, redis, deployment, membershipProcessing, gamification, engagement, outboundMessages, ...queues] = await Promise.all([
    timedCheck(pingDatabase),
    timedCheck(pingRedis),
    inspectDeployment(),
    inspectMembershipProcessing(),
    inspectGamification(),
    inspectEngagement(),
    inspectOutboundMessages(),
    inspectQueue("reservation-reminders", reminderQueue),
    inspectQueue("daily-summary", summaryQueue),
    inspectQueue("engagement", engagementQueue),
    inspectQueue("campaign-delivery", campaignQueue),
  ]);
  const checks = { database, redis };
  const status = Object.values(checks).every((check) => check.status === "ok")
    && queues.every((queue) => queue.status === "ok")
    && queues.every((queue) => queue.scheduleHealth?.status !== "attention")
    && deployment.source.status === "ok"
    && deployment.codeMigrations.status === "ok"
    && deployment.databaseMigrations.status === "ok"
    && membershipProcessing.status !== "error"
    && gamification.status !== "error"
    && engagement.status !== "error"
    && outboundMessages.status !== "error"
    && deployment.migrationDrift?.status !== "mismatch"
    ? "ok"
    : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: {
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      apiHost: env.API_HOST,
      apiPort: env.API_PORT,
      agentModel: env.AGENT_MODEL,
      chatModel: env.CHAT_MODEL,
      sentimentModel: env.SENTIMENT_MODEL,
      openRouterConfigured: Boolean(env.OPENROUTER_API_KEY),
    },
    deployment,
    checks,
    queues,
    operational: {
      membershipProcessing,
      gamification,
      engagement,
      outboundMessages,
    },
  };
}
