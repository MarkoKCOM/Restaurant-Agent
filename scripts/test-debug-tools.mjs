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

const smokePath = await writeJson("smoke.json", {
  status: "failed",
  runId: "smoke-test",
  baseUrl: "http://localhost:3001",
  steps: [{ step: "login" }],
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
          stuckCompletions: 1,
        },
        referrals: {
          guestsWithReferralCode: 7,
          referrerCreditMismatches: 1,
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
assertIncludes(debugBundleManifestOutput, "Commands: 1/3 passed");
assertIncludes(debugBundleManifestOutput, "Running build: abc1234 checkout=abc1234 matches=true");
assertIncludes(debugBundleManifestOutput, "Migration drift: ok code=202605270001 database=202605270001");
assertIncludes(debugBundleManifestOutput, "Membership processing: ok open=2 attempts=3");
assertIncludes(
  debugBundleManifestOutput,
  "Gamification: attention activeChallenges=2 stuckChallenges=1 referralCodes=7 referralCreditMismatches=1",
);
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
  "Gamification",
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
    { name: "Create Reservation", pass: false, detail: "boom requestId=e2e-request-1", durationMs: 14 },
  ],
});

const e2eOutput = await summarize(e2ePath);
assertIncludes(e2eOutput, "Type: e2e");
assertIncludes(e2eOutput, "Status: 1/2 passed");
assertIncludes(e2eOutput, "- Create Reservation: boom requestId=e2e-request-1");
assertIncludes(e2eOutput, 'pnpm debug:logs e2e-request-1 --since "2 hours ago"');

const e2eApiClient = await readFile("apps/e2e/src/api-client.ts", "utf8");
for (const expectedE2eClientContent of [
  '"x-request-id": requestId',
  "fetch failed requestId=",
  "requestId=${traceId}",
]) {
  assertIncludes(e2eApiClient, expectedE2eClientContent);
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

const debugBundleCollector = await readFile("scripts/collect-debug-bundle.mjs", "utf8");
const debugErrorHelpers = await readFile("scripts/lib/debug-errors.mjs", "utf8");
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
  "Agent membership intents:",
  "agent-membership-intents",
  "agent-membership-intents.json",
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
  "manifest.highlights.agentMembershipIntents",
  "readme: readmePath",
]) {
  assertIncludes(debugBundleCollector, requiredReadmeContent);
}

console.log("Debug tool tests passed");
