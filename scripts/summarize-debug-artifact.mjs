#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const artifactPath = process.argv[2];

if (!artifactPath) {
  console.error("Usage: pnpm debug:artifact <path-to-smoke-e2e-or-agent-intent-artifact.json>");
  process.exit(1);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function printLine(label, value) {
  if (value !== undefined && value !== null && value !== "") {
    console.log(`${label}: ${value}`);
  }
}

function printLogTraceCommands(requestIds) {
  const uniqueRequestIds = [...new Set(requestIds.filter(Boolean))];
  if (uniqueRequestIds.length === 0) return;

  console.log("Trace logs:");
  for (const requestId of uniqueRequestIds) {
    console.log(`- pnpm debug:logs ${requestId} --since "2 hours ago"`);
  }
}

function summarizeE2e(report) {
  const results = asArray(report.results);
  const failed = results.filter((result) => !result.pass);

  console.log(`Artifact: ${basename(artifactPath)}`);
  console.log("Type: e2e");
  printLine("Run", report.runId);
  printLine("Status", `${report.passed ?? results.length - failed.length}/${report.total ?? results.length} passed`);
  printLine("API URL", report.apiUrl);
  printLine("Started", report.startedAt);
  printLine("Finished", report.finishedAt);
  printLine("Total ms", report.totalMs);

  if (failed.length === 0) {
    console.log("Failures: none");
    return;
  }

  console.log(`Failures: ${failed.length}`);
  for (const result of failed) {
    console.log(`- ${result.name}: ${result.detail}`);
  }
}

function summarizeSmoke(report) {
  const requests = asArray(report.requests);
  const failedRequests = requests.filter((request) => !request.ok);
  const unhandledFailedRequests = failedRequests.filter((request) => !request.handled);
  const handledFailedRequests = failedRequests.filter((request) => request.handled);

  console.log(`Artifact: ${basename(artifactPath)}`);
  console.log("Type: api-smoke");
  printLine("Run", report.runId);
  printLine("Status", report.status);
  printLine("Base URL", report.baseUrl);
  printLine("Started", report.startedAt);
  printLine("Finished", report.finishedAt);
  printLine("Steps", asArray(report.steps).length);
  printLine("Requests", requests.length);
  printLine("Unhandled HTTP failures", unhandledFailedRequests.length);
  printLine("Handled HTTP failures", handledFailedRequests.length);

  if (report.status === "skipped") {
    printLine("Reason", report.reason);
    return;
  }

  if (report.error) {
    printLine("Error", report.error.message ?? String(report.error));
  }

  const interesting = unhandledFailedRequests.length > 0 ? unhandledFailedRequests : handledFailedRequests.slice(0, 5);
  if (interesting.length === 0) {
    console.log("HTTP failures: none");
    return;
  }

  console.log("HTTP failure samples:");
  for (const request of interesting) {
    const handled = request.handled ? ` handled=${request.handledReason ?? true}` : "";
    const code = request.code ? ` code=${request.code}` : "";
    const requestId = request.requestId ? ` requestId=${request.requestId}` : "";
    console.log(`- ${request.method} ${request.path} -> ${request.status}${code}${requestId}${handled}`);
  }

  if (unhandledFailedRequests.length > 0) {
    printLogTraceCommands(unhandledFailedRequests.map((request) => request.requestId));
  }
}

function summarizeAgentMembershipIntent(report) {
  const results = asArray(report.results);
  const failed = results.filter((result) => !result.ok);

  console.log(`Artifact: ${basename(artifactPath)}`);
  console.log("Type: agent-membership-intent");
  printLine("Run", report.runId);
  printLine("Status", `${report.passed ?? results.length - failed.length}/${report.total ?? results.length} passed`);
  printLine("API URL", report.apiUrl);

  if (failed.length === 0) {
    console.log("Failures: none");
    return;
  }

  console.log(`Failures: ${failed.length}`);
  for (const result of failed) {
    const mismatches = asArray(result.mismatches);
    const details = mismatches.length > 0 ? mismatches.join("; ") : "intent probe failed";
    const requestId = result.requestId ? ` requestId=${result.requestId}` : "";
    console.log(`- ${result.name}: ${details}${requestId}`);
  }

  printLogTraceCommands(failed.map((result) => result.requestId));
}

const raw = await readFile(artifactPath, "utf8");
const report = JSON.parse(raw);

if (report.type === "agent-membership-intent") {
  summarizeAgentMembershipIntent(report);
} else if (Array.isArray(report.results)) {
  summarizeE2e(report);
} else {
  summarizeSmoke(report);
}
