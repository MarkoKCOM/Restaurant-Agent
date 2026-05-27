#!/usr/bin/env node
import { execFile } from "node:child_process";
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

await mkdir(outDir, { recursive: true });

await runStep("health-probe", "node", ["scripts/api-debug-probe.mjs", `${apiUrl}/api/v1/health`], {
  env: {
    REQUEST_ID: `debug-bundle-health-${Date.now()}`,
    EXPECT_STATUS: "200",
  },
});

if (process.env.OPENSEAT_TOKEN) {
  await runStep("admin-diagnostics", "node", ["scripts/api-debug-probe.mjs", `${apiUrl}/api/v1/admin/diagnostics`], {
    env: {
      REQUEST_ID: `debug-bundle-diagnostics-${Date.now()}`,
      EXPECT_STATUS: "200",
    },
  });
} else {
  manifest.commands.push({
    name: "admin-diagnostics",
    status: "skipped",
    reason: "OPENSEAT_TOKEN is not set",
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
