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

const apiUrl = (process.env.OPENSEAT_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const since = readOption("since", "30 minutes ago");
const service = readOption("service", "openseat-api");
const outDir = resolve(process.cwd(), readOption("out", `artifacts/debug-bundles/${stamp()}`));
const manifest = {
  createdAt: new Date().toISOString(),
  apiUrl,
  service,
  since,
  outDir,
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

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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
      queues: queues.map((queue) => ({
        name: queue.name,
        status: queue.status,
        failed: queue.counts?.failed,
        delayed: queue.counts?.delayed,
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
      if (queues.length > 0) {
        lines.push(`- Queues: ${queues.map((queue) => `${queue.name}:${queue.status}/failed=${queue.failed ?? "?"}`).join(", ")}`);
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
} else {
  manifest.commands.push({
    name: "admin-diagnostics",
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
