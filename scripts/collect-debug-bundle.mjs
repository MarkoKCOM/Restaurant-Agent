#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  await runStep("admin-diagnostics", "node", ["scripts/api-debug-probe.mjs", `${apiUrl}/api/v1/admin/diagnostics`], {
    env: {
      OPENSEAT_TOKEN: diagnosticsToken.token,
      REQUEST_ID: `debug-bundle-diagnostics-${Date.now()}`,
      EXPECT_STATUS: "200",
    },
  });
  manifest.commands.at(-1).tokenSource = diagnosticsToken.source;
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

console.log(JSON.stringify({
  outDir,
  manifest: resolve(outDir, "manifest.json"),
  commands: manifest.commands.map((command) => ({
    name: command.name,
    status: command.status,
    outputPath: command.outputPath,
    reason: command.reason,
  })),
}, null, 2));
