#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

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

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSignedSuperAdminToken() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return "";

  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    id: randomUUID(),
    email: "debug-bundle-super-admin@openseat.local",
    restaurantId: null,
    role: "super_admin",
    iat: now,
    exp: now + 60 * 10,
  }));
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
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

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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
      },
      gamification: {
        status: gamification.status,
        challenges: gamification.challenges,
        referrals: gamification.referrals,
        menuExploration: gamification.menuExploration,
        achievements: gamification.achievements,
        leaderboard: gamification.leaderboard,
        streaks: gamification.streaks,
        error: gamification.error,
      },
      engagement: {
        status: engagement.status,
        totals: engagement.totals,
        winBack: engagement.winBack,
        birthdays: engagement.birthdays,
        anniversaries: engagement.anniversaries,
        reviewSolicitation: engagement.reviewSolicitation,
        skippedByReason: engagement.skippedByReason,
        error: engagement.error,
      },
      outboundMessages: {
        status: outboundMessages.status,
        totals: outboundMessages.totals,
        byType: outboundMessages.byType,
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
      })),
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
    const notes = command.reason ?? command.tokenSource ?? (command.exitCode !== undefined ? `exit ${command.exitCode}` : "");
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
      const outboundMessages = adminDiagnostics.outboundMessages ?? {};
      const outboundTotals = outboundMessages.totals ?? {};
      const outboundByType = outboundMessages.byType ?? {};
      lines.push(
        `- Outbound messages: ${outboundMessages.status ?? "unknown"} total=${outboundTotals.total ?? "?"} logged=${outboundTotals.logged ?? "?"} sent=${outboundTotals.sent ?? "?"} failed=${outboundTotals.failed ?? "?"} types=${Object.entries(outboundByType).map(([type, count]) => `${type}:${count}`).join(",") || "none"}`,
      );
      if (agentMembershipIntents) {
        lines.push(
          `- Agent membership intents: ${agentMembershipIntents.status ?? "unknown"} ${agentMembershipIntents.passed ?? "?"}/${agentMembershipIntents.total ?? "?"}`,
        );
      }
      if (queues.length > 0) {
        lines.push(`- Queues: ${queues.map((queue) => `${queue.name}:${queue.status}/failed=${queue.failed ?? "?"}/repeat=${queue.repeatableJobs?.length ?? "?"}`).join(", ")}`);
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
    lines.push("- `membership-debug-summary.txt` for open membership repair rows, engagement job counts, and retry commands.");
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

  const tokenRestaurantId = decodeTokenRestaurantId(diagnosticsToken.token);
  const resolvedMembershipDebugRestaurantId = membershipDebugRestaurantId || tokenRestaurantId;

  if (resolvedMembershipDebugRestaurantId || membershipDebugRestaurantSlug) {
    const membershipCommand = await runStep("membership-debug-summary", "node", ["scripts/membership-debug-summary.mjs"], {
      env: {
        OPENSEAT_API_URL: apiUrl,
        OPENSEAT_TOKEN: diagnosticsToken.token,
        OPENSEAT_RESTAURANT_ID: resolvedMembershipDebugRestaurantId,
        OPENSEAT_RESTAURANT_SLUG: membershipDebugRestaurantSlug,
      },
    });
    membershipCommand.tokenSource = diagnosticsToken.source;
  } else {
    manifest.commands.push({
      name: "membership-debug-summary",
      status: "skipped",
      reason: "OPENSEAT_RESTAURANT_ID, OPENSEAT_BUNDLE_RESTAURANT_ID, OPENSEAT_RESTAURANT_SLUG, OPENSEAT_BUNDLE_RESTAURANT_SLUG, or a restaurant-scoped OPENSEAT_TOKEN is not set",
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
