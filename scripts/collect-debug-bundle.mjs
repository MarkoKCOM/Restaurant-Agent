#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createSignedSuperAdminToken } from "./lib/debug-token.mjs";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return process.env[`OPENSEAT_BUNDLE_${name.toUpperCase().replace(/-/g, "_")}`] ?? fallback;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function decodeTokenRestaurantId(token) {
  const [, payload] = token.split(".");
  if (!payload) return "";

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    return typeof decoded.restaurantId === "string" ? decoded.restaurantId : "";
  } catch {
    return "";
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanToken(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[|`]/g, "")
    .trim();
}

function formatAttentionValue(value, fallback = "?") {
  const cleaned = cleanToken(value);
  return cleaned || fallback;
}

function pushAttentionSamples(samples, label, rows, formatter, limit = 2) {
  for (const row of asArray(rows).slice(0, limit)) {
    if (!isObject(row)) continue;
    samples.push(`${label} ${formatter(row)}`);
  }
}

function buildAttentionSamples({ membershipProcessing, gamification, engagement, campaigns, outboundMessages }, limit = 12) {
  const samples = [];
  pushAttentionSamples(samples, "membership", membershipProcessing.openSamples, (row) =>
    `id=${formatAttentionValue(row.id)} stage=${formatAttentionValue(row.stage)} guest=${formatAttentionValue(row.guestId)} reservation=${formatAttentionValue(row.reservationId, "none")} error=${formatAttentionValue(row.errorCode ?? row.errorName ?? row.errorMessage)}`);

  const challenges = isObject(gamification.challenges) ? gamification.challenges : {};
  pushAttentionSamples(samples, "gamification.stuck-challenge", challenges.stuckSamples, (row) =>
    `progress=${formatAttentionValue(row.id)} guest=${formatAttentionValue(row.guestId)} challenge=${formatAttentionValue(row.challengeId)} value=${formatAttentionValue(row.currentValue)}/${formatAttentionValue(row.targetValue)}`);
  pushAttentionSamples(samples, "gamification.duplicate-progress", challenges.duplicateProgressSamples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} challenge=${formatAttentionValue(row.challengeId)} rows=${formatAttentionValue(row.rowCount)}`);

  const referrals = isObject(gamification.referrals) ? gamification.referrals : {};
  pushAttentionSamples(samples, "gamification.referral-credit", referrals.referrerCreditMismatchSamples, (row) =>
    `referrer=${formatAttentionValue(row.referrerId)} referrals=${formatAttentionValue(row.referralCount)} bonuses=${formatAttentionValue(row.bonusCount)}`);

  const achievements = isObject(gamification.achievements) ? gamification.achievements : {};
  pushAttentionSamples(samples, "gamification.achievement", achievements.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} visits=${formatAttentionValue(row.visitCount)} issue=${formatAttentionValue(row.issue)}`);

  const leaderboard = isObject(gamification.leaderboard) ? gamification.leaderboard : {};
  pushAttentionSamples(samples, "gamification.leaderboard", leaderboard.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} issue=${formatAttentionValue(row.issue)}`);

  const luckySpin = isObject(gamification.luckySpin) ? gamification.luckySpin : {};
  pushAttentionSamples(samples, "gamification.lucky-spin", luckySpin.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} reservation=${formatAttentionValue(row.reservationId, "none")} issue=${formatAttentionValue(row.issue)}`);

  const streaks = isObject(gamification.streaks) ? gamification.streaks : {};
  pushAttentionSamples(samples, "gamification.streak", streaks.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} current=${formatAttentionValue(row.current)} best=${formatAttentionValue(row.best)} week=${formatAttentionValue(row.lastVisitWeek)} issue=${formatAttentionValue(row.issue)}`);

  const winBack = isObject(engagement.winBack) ? engagement.winBack : {};
  pushAttentionSamples(samples, "engagement.win-back", winBack.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} restaurant=${formatAttentionValue(row.restaurantId)} lastVisit=${formatAttentionValue(row.lastVisitDate)} type=${formatAttentionValue(row.dueType)}`);

  const birthdays = isObject(engagement.birthdays) ? engagement.birthdays : {};
  pushAttentionSamples(samples, "engagement.birthday", birthdays.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} restaurant=${formatAttentionValue(row.restaurantId)} birthday=${formatAttentionValue(row.birthday)}`);

  const anniversaries = isObject(engagement.anniversaries) ? engagement.anniversaries : {};
  pushAttentionSamples(samples, "engagement.anniversary", anniversaries.samples, (row) =>
    `guest=${formatAttentionValue(row.guestId)} restaurant=${formatAttentionValue(row.restaurantId)} firstVisit=${formatAttentionValue(row.firstVisitDate)}`);

  const quietHours = isObject(engagement.quietHours) ? engagement.quietHours : {};
  pushAttentionSamples(samples, "engagement.quiet-hours", quietHours.samples, (row) =>
    `job=${formatAttentionValue(row.id)} guest=${formatAttentionValue(row.guestId)} restaurant=${formatAttentionValue(row.restaurantId)} triggerAt=${formatAttentionValue(row.triggerAt)}`);

  const reviewSolicitation = isObject(engagement.reviewSolicitation) ? engagement.reviewSolicitation : {};
  pushAttentionSamples(samples, "engagement.review", reviewSolicitation.samples, (row) =>
    `job=${formatAttentionValue(row.id)} guest=${formatAttentionValue(row.guestId)} issue=${formatAttentionValue(row.issue)} triggerAt=${formatAttentionValue(row.triggerAt)}`);

  pushAttentionSamples(samples, "engagement.recent", engagement.recentAttentionSamples, (row) =>
    `job=${formatAttentionValue(row.id)} guest=${formatAttentionValue(row.guestId)} type=${formatAttentionValue(row.type)} status=${formatAttentionValue(row.status)} reason=${formatAttentionValue(row.skipReason, "none")}`);

  pushAttentionSamples(samples, "campaign.overdue", campaigns.overdueSamples, (row) =>
    `campaign=${formatAttentionValue(row.id)} restaurant=${formatAttentionValue(row.restaurantId)} scheduledAt=${formatAttentionValue(row.scheduledAt, "none")} name=${formatAttentionValue(row.name)}`);

  const outboundAttentionSamples = asArray(outboundMessages.samples).filter((row) =>
    isObject(row) && (row.errorCode || row.status === "failed" || row.status === "skipped"));
  pushAttentionSamples(samples, "outbound", outboundAttentionSamples, (row) =>
    `message=${formatAttentionValue(row.id)} restaurant=${formatAttentionValue(row.restaurantId)} guest=${formatAttentionValue(row.guestId, "none")} type=${formatAttentionValue(row.messageType)} status=${formatAttentionValue(row.status)} error=${formatAttentionValue(row.errorCode, "none")}`);
  const deliveryReadiness = isObject(outboundMessages.deliveryReadiness) ? outboundMessages.deliveryReadiness : {};
  pushAttentionSamples(samples, "outbound.owner-whatsapp-missing", deliveryReadiness.ownerWhatsappMissingSamples, (row) =>
    `restaurant=${formatAttentionValue(row.restaurantId)} slug=${formatAttentionValue(row.slug)} name=${formatAttentionValue(row.name)} ownerPhone=${formatAttentionValue(row.ownerPhoneMasked, "none")} whatsappNumber=${formatAttentionValue(row.whatsappNumberMasked, "none")}`);

  return samples.slice(0, limit);
}

const apiUrl = (process.env.OPENSEAT_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const since = readOption("since", "30 minutes ago");
const service = readOption("service", "openseat-api");
const outDir = resolve(process.cwd(), readOption("out", `artifacts/debug-bundles/${stamp()}`));
const membershipDebugRestaurantId =
  process.env.OPENSEAT_RESTAURANT_ID ||
  process.env.OPENSEAT_BUNDLE_RESTAURANT_ID ||
  "";
const membershipDebugRestaurantSlug =
  process.env.OPENSEAT_RESTAURANT_SLUG ||
  process.env.OPENSEAT_BUNDLE_RESTAURANT_SLUG ||
  "";
const outboundDebugRestaurantId =
  process.env.OPENSEAT_OUTBOUND_RESTAURANT_ID ||
  process.env.OPENSEAT_RESTAURANT_ID ||
  process.env.OPENSEAT_BUNDLE_RESTAURANT_ID ||
  "";
const outboundDebugRestaurantSlug =
  process.env.OPENSEAT_OUTBOUND_RESTAURANT_SLUG ||
  process.env.OPENSEAT_RESTAURANT_SLUG ||
  process.env.OPENSEAT_BUNDLE_RESTAURANT_SLUG ||
  "";
const manifest = {
  createdAt: new Date().toISOString(),
  apiUrl,
  service,
  since,
  outDir,
  readiness: {},
  commands: [],
  highlights: {},
};

const superAdminEmail =
  process.env.OPENSEAT_SUPER_ADMIN_EMAIL ||
  process.env.SUPER_ADMIN_SEED_EMAIL ||
  "";
const superAdminPassword =
  process.env.OPENSEAT_SUPER_ADMIN_PASSWORD ||
  process.env.SUPER_ADMIN_SEED_PASSWORD ||
  "";

async function runStep(name, command, commandArgs, options = {}) {
  const startedAt = Date.now();
  const fileBase = `${name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase()}.txt`;
  const outputPath = resolve(outDir, fileBase);
  const commandRecord = {
    name,
    command: [command, ...commandArgs].join(" "),
    outputPath,
    status: "running",
    elapsedMs: 0,
  };
  manifest.commands.push(commandRecord);

  try {
    const result = await execFileAsync(command, commandArgs, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    });
    commandRecord.status = "passed";
    await writeFile(outputPath, `${result.stdout}${result.stderr ? `\nSTDERR:\n${result.stderr}` : ""}`);
  } catch (error) {
    commandRecord.status = "failed";
    commandRecord.exitCode = error.code ?? null;
    await writeFile(outputPath, `${error.stdout ?? ""}${error.stderr ? `\nSTDERR:\n${error.stderr}` : ""}`);
  } finally {
    commandRecord.elapsedMs = Date.now() - startedAt;
  }

  return commandRecord;
}

async function writeJson(name, value) {
  const outputPath = resolve(outDir, name);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  return outputPath;
}

async function waitForApiReady() {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.OPENSEAT_BUNDLE_READY_TIMEOUT_MS ?? 15_000);
  const intervalMs = Number(process.env.OPENSEAT_BUNDLE_READY_INTERVAL_MS ?? 500);
  let attempts = 0;
  let lastError = "";

  while (Date.now() - startedAt <= timeoutMs) {
    attempts += 1;
    try {
      const response = await fetch(`${apiUrl}/api/v1/health`, {
        headers: { "x-request-id": `debug-bundle-ready-${Date.now()}` },
      });
      if (response.ok) {
        manifest.readiness = {
          status: "ready",
          attempts,
          elapsedMs: Date.now() - startedAt,
        };
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }

  manifest.readiness = {
    status: "timeout",
    attempts,
    elapsedMs: Date.now() - startedAt,
    lastError,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function getJson(url, token, requestId) {
  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-request-id": requestId,
      },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? requestId,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatQueueScheduleHealth(queues, queueName, labels = {}) {
  const queue = queues.find((item) => item.name === queueName && isObject(item.scheduleHealth));
  const health = queue?.scheduleHealth;
  if (!isObject(health)) return "";

  const parts = [`restaurants=${health.restaurantCount ?? "?"}`];
  const checks = Array.isArray(health.checks) ? health.checks : [];
  for (const check of checks) {
    const label = labels[check.name] ?? check.name;
    const wrong = check.wrongPattern ? ` wrongPattern=${check.wrongPattern}` : "";
    parts.push(`${label} expected=${check.expected ?? "?"} found=${check.found ?? "?"} pattern=${check.pattern ?? "?"} status=${check.status ?? "?"}${wrong}`);
  }

  const timezones = isObject(health.restaurantTimezones)
    ? Object.entries(health.restaurantTimezones).map(([timezone, count]) => `${timezone}:${count}`).join(",")
    : "";
  if (timezones) parts.push(`timezones=${timezones}`);

  return parts.join(" ");
}

function formatSummaryScheduleHealth(queues) {
  return formatQueueScheduleHealth(queues, "daily-summary", {
    "daily-morning-summary": "morning",
    "daily-summary": "closing",
  });
}

function formatEngagementScheduleHealth(queues) {
  return formatQueueScheduleHealth(queues, "engagement", {
    "win-back-check": "winBack",
    "birthday-check": "birthday",
    "anniversary-check": "anniversary",
    "birthday-week-challenge-check": "birthdayWeek",
  });
}

function operationalAttentionLabels(adminDiagnostics) {
  const labels = [];
  for (const [label, section] of [
    ["Membership processing", adminDiagnostics.membershipProcessing],
    ["Gamification", adminDiagnostics.gamification],
    ["Engagement", adminDiagnostics.engagement],
    ["Campaigns", adminDiagnostics.campaigns],
    ["Outbound messages", adminDiagnostics.outboundMessages],
  ]) {
    if (section?.status === "attention") labels.push(label);
  }
  const queues = Array.isArray(adminDiagnostics.queues) ? adminDiagnostics.queues : [];
  for (const queue of queues) {
    if (queue.scheduleHealth?.status === "attention") labels.push(`${queue.name} schedule`);
  }
  return labels;
}

function restaurantSelectorFromDiagnostics() {
  const diagnostics = manifest.highlights.adminDiagnostics;
  if (!isObject(diagnostics)) return null;

  const outboundMessages = isObject(diagnostics.outboundMessages) ? diagnostics.outboundMessages : {};
  const deliveryReadiness = isObject(outboundMessages.deliveryReadiness)
    ? outboundMessages.deliveryReadiness
    : {};
  const ownerMissingSample = asArray(deliveryReadiness.ownerWhatsappMissingSamples)
    .find((sample) => isObject(sample) && sample.restaurantId);
  if (ownerMissingSample) {
    return {
      restaurantId: ownerMissingSample.restaurantId,
      restaurantSlug: ownerMissingSample.slug ?? "",
      restaurantName: ownerMissingSample.name ?? "",
      source: "admin-diagnostics ownerWhatsappMissing sample",
    };
  }

  const outboundSample = asArray(outboundMessages.samples)
    .find((sample) => isObject(sample) && sample.restaurantId);
  if (outboundSample) {
    return {
      restaurantId: outboundSample.restaurantId,
      restaurantSlug: "",
      restaurantName: "",
      source: "admin-diagnostics outbound sample",
    };
  }

  const membership = isObject(diagnostics.membershipProcessing) ? diagnostics.membershipProcessing : {};
  const membershipSample = asArray(membership.openSamples)
    .find((sample) => isObject(sample) && sample.restaurantId);
  if (membershipSample) {
    return {
      restaurantId: membershipSample.restaurantId,
      restaurantSlug: "",
      restaurantName: "",
      source: "admin-diagnostics membership sample",
    };
  }

  const engagement = isObject(diagnostics.engagement) ? diagnostics.engagement : {};
  const engagementSample = asArray(engagement.recentAttentionSamples)
    .find((sample) => isObject(sample) && sample.restaurantId);
  if (engagementSample) {
    return {
      restaurantId: engagementSample.restaurantId,
      restaurantSlug: "",
      restaurantName: "",
      source: "admin-diagnostics engagement sample",
    };
  }

  return null;
}

async function resolveBundleRestaurantSelector(token) {
  const diagnosticsSelector = restaurantSelectorFromDiagnostics();
  if (diagnosticsSelector) return diagnosticsSelector;

  const result = await getJson(
    new URL(`${apiUrl}/api/v1/admin/restaurants`),
    token,
    `debug-bundle-restaurant-selector-${Date.now()}`,
  );
  if (!result.ok) {
    return {
      restaurantId: "",
      restaurantSlug: "",
      restaurantName: "",
      source: "",
      reason: `default restaurant lookup failed with HTTP ${result.status ?? "network"} requestId=${result.requestId}`,
    };
  }

  const restaurants = Array.isArray(result.body) ? result.body : [];
  const restaurant = restaurants.find((row) => isObject(row) && row.id);
  if (!restaurant) {
    return {
      restaurantId: "",
      restaurantSlug: "",
      restaurantName: "",
      source: "",
      reason: `default restaurant lookup returned no restaurants requestId=${result.requestId}`,
    };
  }

  return {
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug ?? "",
    restaurantName: restaurant.name ?? "",
    source: `admin/restaurants first result requestId=${result.requestId}`,
  };
}

function formatRestaurantSelector(selector) {
  if (!isObject(selector) || (!selector.restaurantId && !selector.restaurantSlug)) return "";
  const id = selector.restaurantId ? `restaurant=${selector.restaurantId}` : "restaurant=slug-only";
  const slug = selector.restaurantSlug ? ` slug=${selector.restaurantSlug}` : "";
  const name = selector.restaurantName ? ` name=${JSON.stringify(selector.restaurantName)}` : "";
  return `${id}${slug}${name} source=${selector.source ?? "unknown"}`;
}

async function captureAgentIntentHighlights(artifactPath) {
  try {
    const report = await readJson(artifactPath);
    manifest.highlights.agentMembershipIntents = {
      status: report.status,
      passed: report.passed,
      total: report.total,
      failed: report.failed,
      failures: Array.isArray(report.results)
        ? report.results
            .filter((result) => result && result.ok === false)
            .map((result) => ({
              name: result.name,
              requestId: result.requestId,
              mismatches: result.mismatches,
            }))
        : [],
    };
  } catch (error) {
    manifest.highlights.agentMembershipIntents = {
      status: "unparsed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function captureOwnerDeliveryHighlights(artifactPath, commandRecord) {
  if (commandRecord.status !== "passed") return;

  try {
    const report = await readJson(artifactPath);
    const totals = isObject(report.totals) ? report.totals : {};
    const missingRestaurants = asArray(report.missingRestaurants);
    manifest.highlights.ownerDeliveryReadiness = {
      status: report.status ?? "unknown",
      outputPath: artifactPath,
      requestId: report.requestId,
      totals: {
        restaurants: totals.restaurants,
        ownerWhatsappConfigured: totals.ownerWhatsappConfigured,
        ownerWhatsappMissing: totals.ownerWhatsappMissing,
        ownerDeliveryRecipientConfigured: totals.ownerDeliveryRecipientConfigured,
        ownerDeliveryRecipientMissing: totals.ownerDeliveryRecipientMissing,
        ownerDeliveryFallbackAvailable: totals.ownerDeliveryFallbackAvailable,
      },
      missingSamples: missingRestaurants.slice(0, 5).map((restaurant) => ({
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        package: restaurant.package,
        ownerPhoneMasked: restaurant.ownerPhoneMasked,
        whatsappNumberMasked: restaurant.whatsappNumberMasked,
        repairCommand: restaurant.repairCommand,
      })),
    };
  } catch (error) {
    manifest.highlights.ownerDeliveryReadiness = {
      status: "unparsed",
      outputPath: artifactPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function captureDiagnosticsHighlights(commandRecord) {
  if (commandRecord.status !== "passed" || !commandRecord.outputPath) return;

  try {
    const output = JSON.parse(await readFile(commandRecord.outputPath, "utf8"));
    const diagnostics = output.body;
    if (!isObject(diagnostics)) return;

    const deployment = isObject(diagnostics.deployment) ? diagnostics.deployment : {};
    const source = isObject(deployment.source) ? deployment.source : {};
    const migrationDrift = isObject(deployment.migrationDrift) ? deployment.migrationDrift : {};
    const checks = isObject(diagnostics.checks) ? diagnostics.checks : {};
    const operational = isObject(diagnostics.operational) ? diagnostics.operational : {};
    const membershipProcessing = isObject(operational.membershipProcessing)
      ? operational.membershipProcessing
      : {};
    const gamification = isObject(operational.gamification)
      ? operational.gamification
      : {};
    const engagement = isObject(operational.engagement)
      ? operational.engagement
      : {};
    const campaigns = isObject(operational.campaigns)
      ? operational.campaigns
      : {};
    const outboundMessages = isObject(operational.outboundMessages)
      ? operational.outboundMessages
      : {};
    const queues = Array.isArray(diagnostics.queues) ? diagnostics.queues : [];

    manifest.highlights.adminDiagnostics = {
      status: diagnostics.status,
      requestId: diagnostics.requestId,
      source: {
        status: source.status,
        shortCommit: source.shortCommit,
        branch: source.branch,
        dirty: source.dirty,
        builtAt: source.builtAt,
        checkout: source.checkout,
        checkoutMatchesBuild: source.checkoutMatchesBuild,
      },
      migrationDrift: {
        status: migrationDrift.status,
        codeLatestId: migrationDrift.codeLatestId,
        databaseLatestId: migrationDrift.databaseLatestId,
      },
      checks: {
        database: isObject(checks.database) ? checks.database.status : undefined,
        redis: isObject(checks.redis) ? checks.redis.status : undefined,
      },
      membershipProcessing: {
        status: membershipProcessing.status,
        openCount: membershipProcessing.openCount,
        totalOpenAttempts: membershipProcessing.totalOpenAttempts,
        latestOpenAttemptAt: membershipProcessing.latestOpenAttemptAt,
        byStage: membershipProcessing.byStage,
        openSamples: membershipProcessing.openSamples,
      },
      gamification: {
        status: gamification.status,
        challenges: gamification.challenges,
        referrals: gamification.referrals,
        menuExploration: gamification.menuExploration,
        achievements: gamification.achievements,
        leaderboard: gamification.leaderboard,
        luckySpin: gamification.luckySpin,
        streaks: gamification.streaks,
        error: gamification.error,
      },
      engagement: {
        status: engagement.status,
        totals: engagement.totals,
        winBack: engagement.winBack,
        birthdays: engagement.birthdays,
        anniversaries: engagement.anniversaries,
        quietHours: engagement.quietHours,
        reviewSolicitation: engagement.reviewSolicitation,
        skippedByReason: engagement.skippedByReason,
        recentAttentionSamples: engagement.recentAttentionSamples,
        error: engagement.error,
      },
      campaigns: {
        status: campaigns.status,
        totals: campaigns.totals,
        delivery: campaigns.delivery,
        skippedByReason: campaigns.skippedByReason,
        overdueSamples: campaigns.overdueSamples,
        recentSamples: campaigns.recentSamples,
        error: campaigns.error,
      },
      outboundMessages: {
        status: outboundMessages.status,
        statusReasons: outboundMessages.statusReasons,
        totals: outboundMessages.totals,
        byType: outboundMessages.byType,
        byErrorCode: outboundMessages.byErrorCode,
        deliveryReadiness: outboundMessages.deliveryReadiness,
        samples: outboundMessages.samples,
        error: outboundMessages.error,
      },
      queues: queues.map((queue) => ({
        name: queue.name,
        status: queue.status,
        failed: queue.counts?.failed,
        delayed: queue.counts?.delayed,
        repeatableJobs: Array.isArray(queue.repeatableJobs)
          ? queue.repeatableJobs.map((job) => ({
              name: job.name,
              pattern: job.pattern,
              tz: job.tz,
              next: job.next,
            }))
          : undefined,
        scheduleHealth: isObject(queue.scheduleHealth)
          ? queue.scheduleHealth
          : undefined,
      })),
      attentionSamples: buildAttentionSamples({
        membershipProcessing,
        gamification,
        engagement,
        campaigns,
        outboundMessages,
      }),
    };
  } catch (error) {
    manifest.highlights.adminDiagnostics = {
      status: "unparsed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function writeReadme() {
  const lines = [
    "# OpenSeat Debug Bundle",
    "",
    `Created: ${manifest.createdAt}`,
    `API URL: ${apiUrl}`,
    `Service logs: ${service} since ${since}`,
    `Readiness: ${manifest.readiness.status ?? "unknown"} after ${manifest.readiness.attempts ?? "?"} attempt(s)`,
    "",
    "## Status",
    "",
    "| Step | Status | File | Notes |",
    "| --- | --- | --- | --- |",
  ];

  for (const command of manifest.commands) {
    const file = command.outputPath ? command.outputPath.replace(`${outDir}/`, "") : "";
    const notes = [
      command.reason,
      command.tokenSource,
      command.restaurantSelector,
      command.exitCode !== undefined ? `exit ${command.exitCode}` : "",
    ].filter(Boolean).join("; ");
    lines.push(`| ${command.name} | ${command.status} | ${file} | ${notes} |`);
  }

  const adminDiagnostics = manifest.highlights.adminDiagnostics;
  if (adminDiagnostics) {
    lines.push("");
    lines.push("## Highlights");
    lines.push("");
    if (adminDiagnostics.status === "unparsed") {
      lines.push(`- Admin diagnostics could not be parsed: ${adminDiagnostics.error}`);
    } else {
      const source = adminDiagnostics.source ?? {};
      const checkout = source.checkout ?? {};
      const migrationDrift = adminDiagnostics.migrationDrift ?? {};
      const checks = adminDiagnostics.checks ?? {};
      const membershipProcessing = adminDiagnostics.membershipProcessing ?? {};
      const agentMembershipIntents = manifest.highlights.agentMembershipIntents;
      const queues = Array.isArray(adminDiagnostics.queues) ? adminDiagnostics.queues : [];
      lines.push(`- Admin diagnostics: ${adminDiagnostics.status ?? "unknown"}`);
      lines.push(
        `- Running build: ${source.shortCommit ?? "unknown"} on ${source.branch ?? "unknown"}${source.dirty === true ? " (dirty)" : ""}`,
      );
      if (source.builtAt) {
        lines.push(`- Built at: ${source.builtAt}`);
      }
      if (checkout.status) {
        lines.push(
          `- Checkout: ${checkout.shortCommit ?? "unknown"} on ${checkout.branch ?? "unknown"}${checkout.dirty === true ? " (dirty)" : ""}; matches running build=${source.checkoutMatchesBuild === true ? "yes" : "no"}`,
        );
      }
      lines.push(
        `- Migration drift: ${migrationDrift.status ?? "unknown"} (${migrationDrift.codeLatestId ?? "?"}/${migrationDrift.databaseLatestId ?? "?"})`,
      );
      lines.push(`- Dependencies: database=${checks.database ?? "unknown"} redis=${checks.redis ?? "unknown"}`);
      lines.push(
        `- Membership processing: ${membershipProcessing.status ?? "unknown"} open=${membershipProcessing.openCount ?? "?"} attempts=${membershipProcessing.totalOpenAttempts ?? "?"}`,
      );
      const gamification = adminDiagnostics.gamification ?? {};
      const challenges = gamification.challenges ?? {};
      const referrals = gamification.referrals ?? {};
      const menuExploration = gamification.menuExploration ?? {};
      const achievements = gamification.achievements ?? {};
      const leaderboard = gamification.leaderboard ?? {};
      const streaks = gamification.streaks ?? {};
      lines.push(
        `- Gamification: ${gamification.status ?? "unknown"} activeChallenges=${challenges.active ?? "?"} smokeChallenges=${challenges.activeSmokeChallenges ?? "?"} birthdayWeekActive=${challenges.activeBirthdayWeekChallenges ?? "?"} birthdayWeekDue=${challenges.birthdayWeekDueUncreated ?? "?"} stuckChallenges=${challenges.stuckCompletions ?? "?"} duplicateProgress=${challenges.duplicateProgressGroups ?? "?"} referralCodes=${referrals.guestsWithReferralCode ?? "?"} referralCreditMismatches=${referrals.referrerCreditMismatches ?? "?"} menuBadgeGuests=${menuExploration.guestsWithBadges ?? "?"} achievementGuests=${achievements.guestsWithAchievements ?? "?"} achievementMissing=${achievements.firstVisitMissing ?? "?"}/${achievements.tenVisitMissing ?? "?"} invalidAchievements=${achievements.invalid ?? "?"} leaderboardOptedIn=${leaderboard.optedIn ?? "?"} leaderboardRewardMissing=${leaderboard.topThreeRewardMissing ?? "?"} invalidLeaderboard=${leaderboard.invalid ?? "?"} streakActive=${streaks.active ?? "?"} staleStreaks=${streaks.stale ?? "?"} invalidStreaks=${streaks.invalid ?? "?"} streakBonusMissing=${streaks.milestoneBonusMissing ?? "?"}`,
      );
      const engagement = adminDiagnostics.engagement ?? {};
      const engagementTotals = engagement.totals ?? {};
      const winBack = engagement.winBack ?? {};
      const birthdays = engagement.birthdays ?? {};
      const anniversaries = engagement.anniversaries ?? {};
      const reviewSolicitation = engagement.reviewSolicitation ?? {};
      lines.push(
        `- Engagement: ${engagement.status ?? "unknown"} pending=${engagementTotals.pending ?? "?"} overdue=${engagementTotals.overduePending ?? "?"} failed=${engagementTotals.failed ?? "?"} skipped=${engagementTotals.skipped ?? "?"} winBackDue=${winBack.dueUnscheduledTotal ?? "?"} birthdayDue=${birthdays.dueUnscheduledToday ?? "?"} anniversaryDue=${anniversaries.dueUnscheduledToday ?? "?"} reviewWithoutPositive=${reviewSolicitation.pendingWithoutPositiveFeedback ?? "?"} negativeWithReview=${reviewSolicitation.negativeFeedbackWithPendingReview ?? "?"}`,
      );
      const campaigns = adminDiagnostics.campaigns ?? {};
      const campaignTotals = campaigns.totals ?? {};
      const campaignDelivery = campaigns.delivery ?? {};
      lines.push(
        `- Campaigns: ${campaigns.status ?? "unknown"} total=${campaignTotals.total ?? "?"} draft=${campaignTotals.draft ?? "?"} scheduled=${campaignTotals.scheduled ?? "?"} sent=${campaignTotals.sent ?? "?"} overdue=${campaignTotals.overdueScheduled ?? "?"} deliverySent=${campaignDelivery.sent ?? "?"} skipped=${campaignDelivery.skipped ?? "?"} optedOut=${campaignDelivery.skippedOptedOut ?? "?"} weekLimit=${campaignDelivery.skippedRateLimitedWeek ?? "?"} monthLimit=${campaignDelivery.skippedRateLimitedMonth ?? "?"}`,
      );
      const outboundMessages = adminDiagnostics.outboundMessages ?? {};
      const outboundTotals = outboundMessages.totals ?? {};
      const outboundByType = outboundMessages.byType ?? {};
      const outboundByErrorCode = outboundMessages.byErrorCode ?? {};
      const outboundDeliveryReadiness = outboundMessages.deliveryReadiness ?? {};
      const outboundReasons = asArray(outboundMessages.statusReasons).join(",") || "none";
      const ownerDeliveryReadiness = manifest.highlights.ownerDeliveryReadiness;
      lines.push(
        `- Outbound messages: ${outboundMessages.status ?? "unknown"} reasons=${outboundReasons} total=${outboundTotals.total ?? "?"} logged=${outboundTotals.logged ?? "?"} sent=${outboundTotals.sent ?? "?"} skipped=${outboundTotals.skipped ?? "?"} failed=${outboundTotals.failed ?? "?"} ownerWhatsappMissing=${outboundDeliveryReadiness.ownerWhatsappMissing ?? "?"} ownerDeliveryBlocked=${outboundDeliveryReadiness.ownerDeliveryBlocked === true ? "yes" : "no"} configOnly=${outboundDeliveryReadiness.ownerWhatsappConfigOnlyMissing === true ? "yes" : "no"} types=${Object.entries(outboundByType).map(([type, count]) => `${type}:${count}`).join(",") || "none"} errors=${Object.entries(outboundByErrorCode).map(([code, count]) => `${code}:${count}`).join(",") || "none"}`,
      );
      if (ownerDeliveryReadiness?.status === "unparsed") {
        lines.push(`- Owner delivery readiness: unparsed file=${ownerDeliveryReadiness.outputPath ?? "unknown"} error=${ownerDeliveryReadiness.error}`);
      } else if (ownerDeliveryReadiness) {
        const totals = ownerDeliveryReadiness.totals ?? {};
        lines.push(
          `- Owner delivery readiness: ${ownerDeliveryReadiness.status ?? "unknown"} total=${totals.restaurants ?? "?"} configured=${totals.ownerWhatsappConfigured ?? "?"} missing=${totals.ownerWhatsappMissing ?? "?"}`,
        );
        lines.push(
          `- Owner delivery recipients: configured=${totals.ownerDeliveryRecipientConfigured ?? "?"} missing=${totals.ownerDeliveryRecipientMissing ?? "?"} fallbackAvailable=${totals.ownerDeliveryFallbackAvailable ?? "?"}`,
        );
        const missingSamples = asArray(ownerDeliveryReadiness.missingSamples);
        if (missingSamples.length > 0) {
          lines.push("- Owner delivery repair samples:");
          for (const restaurant of missingSamples.slice(0, 3)) {
            lines.push(
              `  - ${restaurant.id ?? "?"} slug=${restaurant.slug ?? "none"} name=${JSON.stringify(restaurant.name ?? "")} repair=${restaurant.repairCommand ?? "unknown"}`,
            );
          }
        }
      }
      if (agentMembershipIntents) {
        lines.push(
          `- Agent membership intents: ${agentMembershipIntents.status ?? "unknown"} ${agentMembershipIntents.passed ?? "?"}/${agentMembershipIntents.total ?? "?"}`,
        );
      }
      const defaultRestaurantSelector = manifest.highlights.defaultRestaurantSelector;
      if (defaultRestaurantSelector?.status === "resolved") {
        const slug = defaultRestaurantSelector.restaurantSlug ? ` slug=${defaultRestaurantSelector.restaurantSlug}` : "";
        const name = defaultRestaurantSelector.restaurantName ? ` name=${JSON.stringify(defaultRestaurantSelector.restaurantName)}` : "";
        lines.push(
          `- Default restaurant selector: ${defaultRestaurantSelector.restaurantId}${slug}${name} source=${defaultRestaurantSelector.source ?? "unknown"}`,
        );
      } else if (defaultRestaurantSelector?.status === "unresolved") {
        lines.push(`- Default restaurant selector: unresolved reason=${defaultRestaurantSelector.reason}`);
      }
      if (queues.length > 0) {
        lines.push(`- Queues: ${queues.map((queue) => `${queue.name}:${queue.status}/failed=${queue.failed ?? "?"}/repeat=${queue.repeatableJobs?.length ?? "?"}`).join(", ")}`);
      }
      const summaryScheduleHealth = formatSummaryScheduleHealth(queues);
      if (summaryScheduleHealth) {
        lines.push(`- Summary schedules: ${summaryScheduleHealth}`);
      }
      const engagementScheduleHealth = formatEngagementScheduleHealth(queues);
      if (engagementScheduleHealth) {
        lines.push(`- Engagement schedules: ${engagementScheduleHealth}`);
      }
      const attention = operationalAttentionLabels(adminDiagnostics);
      if (attention.length > 0) {
        lines.push(`- Operational attention: ${attention.join(", ")}`);
      }
      const attentionSamples = asArray(adminDiagnostics.attentionSamples);
      if (attentionSamples.length > 0) {
        lines.push("- Attention samples:");
        for (const sample of attentionSamples.slice(0, 12)) {
          lines.push(`  - ${sample}`);
        }
      }
      if (adminDiagnostics.requestId) {
        lines.push(`- Diagnostics request: ${adminDiagnostics.requestId}`);
      }
    }
  }

  const failed = manifest.commands.filter((command) => command.status === "failed");
  const skipped = manifest.commands.filter((command) => command.status === "skipped");
  lines.push("");
  lines.push("## Open First");
  lines.push("");
  if (failed.length > 0) {
    lines.push("- Open failed step files first, then use request IDs inside them with `pnpm debug:logs <request-id>`.");
  } else {
    lines.push("- `admin-diagnostics.txt` for database, Redis, migration drift, queue, and runtime health.");
    lines.push("- `queue-debug-summary.txt` for BullMQ repeatable jobs, delayed jobs, and failed job samples.");
    lines.push("- `membership-debug-summary.txt` for open membership repair rows, engagement job counts, and retry commands.");
    lines.push("- `outbound-debug-summary.txt` for the recent WhatsApp-bound message log and message IDs.");
    lines.push("- `owner-delivery-readiness.txt` for restaurants missing owner WhatsApp delivery settings.");
    lines.push("- `package-enforcement-smoke.txt` for starter-vs-Growth package guard probes.");
    lines.push("- `api-smoke-summary.txt` for end-to-end API flow status and any failing request IDs.");
    lines.push("- `recent-api-logs.txt` for service-side context around this bundle run.");
  }
  if (skipped.length > 0) {
    lines.push(`- Skipped steps: ${skipped.map((command) => command.name).join(", ")}.`);
  }
  lines.push("- `manifest.json` contains command metadata and elapsed times.");
  lines.push("");

  const outputPath = resolve(outDir, "README.md");
  await writeFile(outputPath, `${lines.join("\n")}\n`);
  return outputPath;
}

async function getDiagnosticsToken() {
  if (process.env.OPENSEAT_TOKEN) {
    return { token: process.env.OPENSEAT_TOKEN, source: "OPENSEAT_TOKEN" };
  }

  const syntheticToken = createSignedSuperAdminToken();
  if (syntheticToken) {
    return { token: syntheticToken, source: "JWT_SECRET synthetic super_admin token" };
  }

  if (!superAdminEmail || !superAdminPassword) {
    return {
      token: "",
      source: "",
      reason: "OPENSEAT_TOKEN or super-admin credentials are not set",
    };
  }

  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": `debug-bundle-login-${Date.now()}`,
    },
    body: JSON.stringify({
      email: superAdminEmail,
      password: superAdminPassword,
    }),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.token) {
    return {
      token: "",
      source: "",
      reason: `super-admin login failed with HTTP ${response.status}`,
    };
  }

  return { token: body.token, source: "super-admin login" };
}

await mkdir(outDir, { recursive: true });
await waitForApiReady();

await runStep("health-probe", "node", ["scripts/api-debug-probe.mjs", `${apiUrl}/api/v1/health`], {
  env: {
    REQUEST_ID: `debug-bundle-health-${Date.now()}`,
    EXPECT_STATUS: "200",
  },
});

await runStep("queue-debug-summary", "pnpm", ["--filter", "@openseat/api", "queue:debug"], {
  env: {
    OPENSEAT_QUEUE_DEBUG_SAMPLE_LIMIT: process.env.OPENSEAT_QUEUE_DEBUG_SAMPLE_LIMIT ?? "5",
  },
});

const diagnosticsToken = await getDiagnosticsToken();
if (diagnosticsToken.token) {
  const diagnosticsCommand = await runStep("admin-diagnostics", "node", ["scripts/api-debug-probe.mjs", `${apiUrl}/api/v1/admin/diagnostics`], {
    env: {
      OPENSEAT_TOKEN: diagnosticsToken.token,
      REQUEST_ID: `debug-bundle-diagnostics-${Date.now()}`,
      EXPECT_STATUS: "200",
    },
  });
  diagnosticsCommand.tokenSource = diagnosticsToken.source;
  await captureDiagnosticsHighlights(diagnosticsCommand);

  const packageCommand = await runStep("package-enforcement-smoke", "node", ["scripts/package-enforcement-smoke.mjs"], {
    env: {
      OPENSEAT_API_URL: apiUrl,
      OPENSEAT_TOKEN: diagnosticsToken.token,
    },
  });
  packageCommand.tokenSource = diagnosticsToken.source;

  const ownerDeliveryArtifactPath = resolve(outDir, "owner-delivery-readiness.json");
  const ownerDeliveryCommand = await runStep("owner-delivery-readiness", "node", ["scripts/owner-delivery-readiness.mjs"], {
    env: {
      OPENSEAT_API_URL: apiUrl,
      OPENSEAT_TOKEN: diagnosticsToken.token,
      OPENSEAT_OWNER_DELIVERY_ARTIFACT_PATH: ownerDeliveryArtifactPath,
    },
  });
  ownerDeliveryCommand.tokenSource = diagnosticsToken.source;
  ownerDeliveryCommand.artifactPath = ownerDeliveryArtifactPath;
  await captureOwnerDeliveryHighlights(ownerDeliveryArtifactPath, ownerDeliveryCommand);

  const tokenRestaurantId = decodeTokenRestaurantId(diagnosticsToken.token);
  const needsDefaultRestaurantSelector =
    (!membershipDebugRestaurantId && !membershipDebugRestaurantSlug && !tokenRestaurantId)
    || (!outboundDebugRestaurantId && !outboundDebugRestaurantSlug && !tokenRestaurantId);
  const defaultRestaurantSelector = needsDefaultRestaurantSelector
    ? await resolveBundleRestaurantSelector(diagnosticsToken.token)
    : null;
  if (defaultRestaurantSelector?.reason) {
    manifest.highlights.defaultRestaurantSelector = {
      status: "unresolved",
      reason: defaultRestaurantSelector.reason,
    };
  } else if (defaultRestaurantSelector?.restaurantId) {
    manifest.highlights.defaultRestaurantSelector = {
      status: "resolved",
      restaurantId: defaultRestaurantSelector.restaurantId,
      restaurantSlug: defaultRestaurantSelector.restaurantSlug,
      restaurantName: defaultRestaurantSelector.restaurantName,
      source: defaultRestaurantSelector.source,
    };
  }
  const tokenSelector = tokenRestaurantId
    ? {
        restaurantId: tokenRestaurantId,
        restaurantSlug: "",
        restaurantName: "",
        source: "token restaurantId",
      }
    : null;
  const membershipSelector = membershipDebugRestaurantId
    ? {
        restaurantId: membershipDebugRestaurantId,
        restaurantSlug: membershipDebugRestaurantSlug,
        restaurantName: "",
        source: "env",
      }
    : membershipDebugRestaurantSlug
      ? {
          restaurantId: "",
          restaurantSlug: membershipDebugRestaurantSlug,
          restaurantName: "",
          source: "env slug",
        }
    : tokenSelector ?? defaultRestaurantSelector;
  const outboundSelector = outboundDebugRestaurantId
    ? {
        restaurantId: outboundDebugRestaurantId,
        restaurantSlug: outboundDebugRestaurantSlug,
        restaurantName: "",
        source: "env",
      }
    : outboundDebugRestaurantSlug
      ? {
          restaurantId: "",
          restaurantSlug: outboundDebugRestaurantSlug,
          restaurantName: "",
          source: "env slug",
        }
    : tokenSelector ?? defaultRestaurantSelector;
  const resolvedMembershipDebugRestaurantId = membershipSelector?.restaurantId ?? "";
  const resolvedOutboundDebugRestaurantId = outboundSelector?.restaurantId ?? "";
  const resolvedMembershipDebugRestaurantSlug = membershipDebugRestaurantSlug || "";
  const resolvedOutboundDebugRestaurantSlug = outboundDebugRestaurantSlug || "";

  if (resolvedMembershipDebugRestaurantId || resolvedMembershipDebugRestaurantSlug) {
    const membershipCommand = await runStep("membership-debug-summary", "node", ["scripts/membership-debug-summary.mjs"], {
      env: {
        OPENSEAT_API_URL: apiUrl,
        OPENSEAT_TOKEN: diagnosticsToken.token,
        OPENSEAT_RESTAURANT_ID: resolvedMembershipDebugRestaurantId,
        OPENSEAT_RESTAURANT_SLUG: resolvedMembershipDebugRestaurantSlug,
      },
    });
    membershipCommand.tokenSource = diagnosticsToken.source;
    membershipCommand.restaurantSelector = formatRestaurantSelector(membershipSelector);
  } else {
    manifest.commands.push({
      name: "membership-debug-summary",
      status: "skipped",
      reason: defaultRestaurantSelector?.reason
        ?? "OPENSEAT_RESTAURANT_ID, OPENSEAT_BUNDLE_RESTAURANT_ID, OPENSEAT_RESTAURANT_SLUG, OPENSEAT_BUNDLE_RESTAURANT_SLUG, a restaurant-scoped OPENSEAT_TOKEN, or an auto-selected restaurant is not available",
    });
  }

  if (resolvedOutboundDebugRestaurantId || resolvedOutboundDebugRestaurantSlug) {
    const outboundCommand = await runStep("outbound-debug-summary", "node", ["scripts/outbound-debug-summary.mjs"], {
      env: {
        OPENSEAT_API_URL: apiUrl,
        OPENSEAT_TOKEN: diagnosticsToken.token,
        OPENSEAT_RESTAURANT_ID: resolvedOutboundDebugRestaurantId,
        OPENSEAT_RESTAURANT_SLUG: resolvedOutboundDebugRestaurantSlug,
        OPENSEAT_OUTBOUND_DEBUG_LIMIT: process.env.OPENSEAT_OUTBOUND_DEBUG_LIMIT ?? "25",
      },
    });
    outboundCommand.tokenSource = diagnosticsToken.source;
    outboundCommand.restaurantSelector = formatRestaurantSelector(outboundSelector);
  } else {
    manifest.commands.push({
      name: "outbound-debug-summary",
      status: "skipped",
      reason: defaultRestaurantSelector?.reason
        ?? "OPENSEAT_OUTBOUND_RESTAURANT_ID, OPENSEAT_OUTBOUND_RESTAURANT_SLUG, OPENSEAT_RESTAURANT_ID, OPENSEAT_BUNDLE_RESTAURANT_ID, OPENSEAT_RESTAURANT_SLUG, OPENSEAT_BUNDLE_RESTAURANT_SLUG, a restaurant-scoped OPENSEAT_TOKEN, or an auto-selected restaurant is not available",
    });
  }
} else {
  manifest.commands.push({
    name: "admin-diagnostics",
    status: "skipped",
    reason: diagnosticsToken.reason,
  });
  manifest.commands.push({
    name: "membership-debug-summary",
    status: "skipped",
    reason: diagnosticsToken.reason,
  });
  manifest.commands.push({
    name: "outbound-debug-summary",
    status: "skipped",
    reason: diagnosticsToken.reason,
  });
  manifest.commands.push({
    name: "package-enforcement-smoke",
    status: "skipped",
    reason: diagnosticsToken.reason,
  });
  manifest.commands.push({
    name: "owner-delivery-readiness",
    status: "skipped",
    reason: diagnosticsToken.reason,
  });
}

if (process.env.OPENSEAT_ADMIN_PASSWORD || process.env.SABLE_ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD) {
  const smokeArtifactPath = resolve(outDir, "api-reliability-smoke.json");
  await runStep("api-smoke", "node", ["scripts/api-reliability-smoke.mjs"], {
    env: {
      OPENSEAT_API_URL: apiUrl,
      OPENSEAT_SMOKE_ARTIFACT_PATH: smokeArtifactPath,
    },
  });

  await runStep("api-smoke-summary", "node", ["scripts/summarize-debug-artifact.mjs", smokeArtifactPath]);
} else {
  manifest.commands.push({
    name: "api-smoke",
    status: "skipped",
    reason: "OPENSEAT_ADMIN_PASSWORD, SABLE_ADMIN_PASSWORD, or ADMIN_SEED_PASSWORD is not set",
  });
}

const agentIntentArtifactPath = resolve(outDir, "agent-membership-intents.json");
await runStep("agent-membership-intents", "node", ["scripts/agent-membership-intent-smoke.mjs"], {
  env: {
    OPENSEAT_API_URL: apiUrl,
    OPENSEAT_AGENT_INTENT_ARTIFACT_PATH: agentIntentArtifactPath,
    OPENSEAT_TOKEN: diagnosticsToken.token || process.env.OPENSEAT_TOKEN,
  },
});
await captureAgentIntentHighlights(agentIntentArtifactPath);

await runStep("recent-api-logs", "journalctl", [
  "-u",
  service,
  "--since",
  since,
  "--no-pager",
  "-o",
  "short-iso",
]);

await writeJson("manifest.json", manifest);
const readmePath = await writeReadme();

console.log(JSON.stringify({
  outDir,
  manifest: resolve(outDir, "manifest.json"),
  readme: readmePath,
  commands: manifest.commands.map((command) => ({
    name: command.name,
    status: command.status,
    outputPath: command.outputPath,
    reason: command.reason,
  })),
}, null, 2));
