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
    ".github/workflows/deploy.yml",
    "package.json",
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

const e2ePath = await writeJson("e2e.json", {
  runId: "e2e-test",
  apiUrl: "http://localhost:3001",
  total: 2,
  passed: 1,
  failed: 1,
  totalMs: 15,
  results: [
    { name: "Health Check", pass: true, detail: "ok", durationMs: 1 },
    { name: "Create Reservation", pass: false, detail: "boom", durationMs: 14 },
  ],
});

const e2eOutput = await summarize(e2ePath);
assertIncludes(e2eOutput, "Type: e2e");
assertIncludes(e2eOutput, "Status: 1/2 passed");
assertIncludes(e2eOutput, "- Create Reservation: boom");

const deployWorkflow = await readFile(".github/workflows/deploy.yml", "utf8");
for (const requiredPath of [
  ".github/workflows/deploy.yml",
  "apps/booking-widget/**",
  "apps/dashboard/**",
  "apps/marketing-site/**",
  "packages/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
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
]) {
  assert(!deployWorkflowMatches(changedPath), `Expected ${changedPath} to skip Vercel deploy`);
}

console.log("Debug tool tests passed");
