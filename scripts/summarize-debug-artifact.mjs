#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const artifactPath = process.argv[2];

if (!artifactPath) {
  console.error("Usage: pnpm debug:artifact <path-to-smoke-e2e-agent-intent-or-debug-bundle-artifact.json>");
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

function requestIdsFromText(value) {
  if (typeof value !== "string") return [];

  return [...value.matchAll(/\b(?:requestId|request|x-request-id)[=: ]+([A-Za-z0-9._:-]{8,128})\b/g)]
    .map((match) => match[1]);
}

function formatCheckout(value) {
  if (!value || typeof value !== "object") return value ?? "unknown";
  return value.shortCommit ?? value.commit ?? value.status ?? "unknown";
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

  const diagnosticResults = results.filter((result) =>
    result.pass
    && typeof result.name === "string"
    && /diagnostics?/i.test(result.name)
    && typeof result.detail === "string"
  );
  if (diagnosticResults.length > 0) {
    console.log("Diagnostics:");
    for (const result of diagnosticResults) {
      console.log(`- ${result.name}: ${result.detail}`);
    }
  }

  if (failed.length === 0) {
    console.log("Failures: none");
    return;
  }

  console.log(`Failures: ${failed.length}`);
  for (const result of failed) {
    console.log(`- ${result.name}: ${result.detail}`);
  }
  printLogTraceCommands(failed.flatMap((result) => requestIdsFromText(result.detail)));
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

  const operationalSteps = asArray(report.steps).filter((step) =>
    typeof step.step === "string"
    && (
      step.step === "membership.processing-failures"
      || step.step === "engagement.jobs"
      || step.step === "gamification.challenge-progress"
      || step.step === "gamification.challenge.cleanup"
      || step.step === "gamification.future-challenge.window"
      || step.step === "gamification.future-challenge.cleanup"
      || step.step === "gamification.expired-challenge.window"
      || step.step === "gamification.expired-challenge.cleanup"
    )
  );
  if (operationalSteps.length > 0) {
    console.log("Operational smoke:");
    for (const step of operationalSteps) {
      if (step.step === "membership.processing-failures") {
        console.log(`- membership.processing-failures: open=${step.openCount ?? "?"} related=${step.relatedOpenCount ?? "?"}`);
      } else if (step.step === "engagement.jobs") {
        console.log(`- engagement.jobs: count=${step.jobCount ?? "?"} statuses=${asArray(step.statuses).join(",") || "none"} types=${asArray(step.types).join(",") || "none"}`);
      } else if (step.step === "gamification.challenge-progress") {
        console.log(`- gamification.challenge-progress: progress=${step.progress ?? "?"}/${step.target ?? "?"} status=${step.status ?? "?"} completed=${step.completed === true ? "yes" : "no"}`);
      } else if (step.step === "gamification.challenge.cleanup") {
        console.log(`- gamification.challenge.cleanup: active=${step.isActive === false ? "no" : "yes"} challengeId=${step.challengeId ?? "?"}`);
      } else if (step.step === "gamification.future-challenge.window") {
        console.log(`- gamification.future-challenge.window: listedActive=${step.listedAsActive === true ? "yes" : "no"} startDate=${step.startDate ?? "?"}`);
      } else if (step.step === "gamification.future-challenge.cleanup") {
        console.log(`- gamification.future-challenge.cleanup: active=${step.isActive === false ? "no" : "yes"} challengeId=${step.challengeId ?? "?"}`);
      } else if (step.step === "gamification.expired-challenge.window") {
        console.log(`- gamification.expired-challenge.window: listedActive=${step.listedAsActive === true ? "yes" : "no"} endDate=${step.endDate ?? "?"}`);
      } else if (step.step === "gamification.expired-challenge.cleanup") {
        console.log(`- gamification.expired-challenge.cleanup: active=${step.isActive === false ? "no" : "yes"} challengeId=${step.challengeId ?? "?"}`);
      }
    }
  }

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
    const error = result.error;
    const details = error?.message
      ? `${error.message}${error.cause?.code ? ` code=${error.cause.code}` : ""}`
      : mismatches.length > 0
        ? mismatches.join("; ")
        : "intent probe failed";
    const requestId = result.requestId ? ` requestId=${result.requestId}` : "";
    console.log(`- ${result.name}: ${details}${requestId}`);
  }

  printLogTraceCommands(failed.map((result) => result.requestId));
}

function summarizeDebugBundleManifest(report) {
  const commands = asArray(report.commands);
  const failed = commands.filter((command) => command.status === "failed");
  const skipped = commands.filter((command) => command.status === "skipped");
  const passed = commands.filter((command) => command.status === "passed");
  const membershipDebugSummary = commands.find((command) => command.name === "membership-debug-summary");
  const highlights = report.highlights ?? {};
  const adminDiagnostics = highlights.adminDiagnostics ?? {};
  const source = adminDiagnostics.source ?? {};
  const migrationDrift = adminDiagnostics.migrationDrift ?? {};
  const checks = adminDiagnostics.checks ?? {};
  const membershipProcessing = adminDiagnostics.membershipProcessing ?? {};
  const gamification = adminDiagnostics.gamification ?? {};
  const gamificationChallenges = gamification.challenges ?? {};
  const gamificationReferrals = gamification.referrals ?? {};
  const engagement = adminDiagnostics.engagement ?? {};
  const engagementTotals = engagement.totals ?? {};
  const agentMembershipIntents = highlights.agentMembershipIntents ?? {};
  const queues = asArray(adminDiagnostics.queues);

  console.log(`Artifact: ${basename(artifactPath)}`);
  console.log("Type: debug-bundle");
  printLine("Created", report.createdAt);
  printLine("API URL", report.apiUrl);
  printLine("Service", report.service);
  printLine("Since", report.since);
  printLine("Output dir", report.outDir);
  if (report.readiness) {
    printLine("Readiness", `${report.readiness.status ?? "unknown"} after ${report.readiness.attempts ?? "?"} attempt(s)`);
  }
  printLine("Commands", `${passed.length}/${commands.length} passed`);

  if (adminDiagnostics.status) {
    printLine("Admin diagnostics", adminDiagnostics.status);
  }
  if (source.status || source.shortCommit || source.checkout) {
    const match = source.checkoutMatchesBuild === undefined ? "unknown" : String(source.checkoutMatchesBuild);
    printLine(
      "Running build",
      `${source.shortCommit ?? "unknown"} checkout=${formatCheckout(source.checkout)} matches=${match}`,
    );
  }
  if (migrationDrift.status) {
    printLine(
      "Migration drift",
      `${migrationDrift.status} code=${migrationDrift.codeLatestId ?? "?"} database=${migrationDrift.databaseLatestId ?? "?"}`,
    );
  }
  if (checks.database || checks.redis) {
    printLine("Dependencies", `database=${checks.database ?? "unknown"} redis=${checks.redis ?? "unknown"}`);
  }
  if (membershipProcessing.status) {
    printLine(
      "Membership processing",
      `${membershipProcessing.status} open=${membershipProcessing.openCount ?? "?"} attempts=${membershipProcessing.totalOpenAttempts ?? "?"}`,
    );
  }
  if (membershipDebugSummary) {
    const output = membershipDebugSummary.outputPath ? ` output=${membershipDebugSummary.outputPath}` : "";
    const reason = membershipDebugSummary.reason ? ` reason=${membershipDebugSummary.reason}` : "";
    printLine("Membership repair summary", `${membershipDebugSummary.status}${output}${reason}`);
  }
  if (gamification.status) {
    printLine(
      "Gamification",
      `${gamification.status} activeChallenges=${gamificationChallenges.active ?? "?"} smokeChallenges=${gamificationChallenges.activeSmokeChallenges ?? "?"} stuckChallenges=${gamificationChallenges.stuckCompletions ?? "?"} referralCodes=${gamificationReferrals.guestsWithReferralCode ?? "?"} referralCreditMismatches=${gamificationReferrals.referrerCreditMismatches ?? "?"}`,
    );
  }
  if (engagement.status) {
    printLine(
      "Engagement",
      `${engagement.status} pending=${engagementTotals.pending ?? "?"} overdue=${engagementTotals.overduePending ?? "?"} failed=${engagementTotals.failed ?? "?"} skipped=${engagementTotals.skipped ?? "?"}`,
    );
  }
  if (agentMembershipIntents.status) {
    printLine(
      "Agent membership intents",
      `${agentMembershipIntents.status} ${agentMembershipIntents.passed ?? "?"}/${agentMembershipIntents.total ?? "?"}`,
    );
  }
  if (queues.length > 0) {
    printLine("Queues", queues.map((queue) => `${queue.name}:${queue.status}/failed=${queue.failed ?? "?"}`).join(", "));
  }

  if (failed.length === 0 && skipped.length === 0) {
    console.log("Bundle issues: none");
    return;
  }

  if (failed.length > 0) {
    console.log(`Failed commands: ${failed.length}`);
    for (const command of failed) {
      const exitCode = command.exitCode === undefined || command.exitCode === null ? "" : ` exitCode=${command.exitCode}`;
      const outputPath = command.outputPath ? ` output=${command.outputPath}` : "";
      console.log(`- ${command.name}:${exitCode}${outputPath}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`Skipped commands: ${skipped.length}`);
    for (const command of skipped) {
      const reason = command.reason ? ` reason=${command.reason}` : "";
      console.log(`- ${command.name}:${reason}`);
    }
  }
}

const raw = await readFile(artifactPath, "utf8");
const report = JSON.parse(raw);

if (Array.isArray(report.commands) && report.createdAt) {
  summarizeDebugBundleManifest(report);
} else if (report.type === "agent-membership-intent") {
  summarizeAgentMembershipIntent(report);
} else if (Array.isArray(report.results)) {
  summarizeE2e(report);
} else {
  summarizeSmoke(report);
}
