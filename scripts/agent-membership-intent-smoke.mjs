#!/usr/bin/env node

const apiUrl = (process.env.OPENSEAT_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const artifactPath = process.env.OPENSEAT_AGENT_INTENT_ARTIFACT_PATH;
const runId = `agent-intent-${Date.now()}`;

const cases = [
  {
    name: "Hebrew balance",
    message: "כמה נקודות יש לי במועדון?",
    intent: "membership_summary",
    expectedTool: "get_membership_summary",
    language: "he",
  },
  {
    name: "English rewards",
    message: "Do I have any reward I can claim?",
    intent: "reward_help",
    expectedTool: "get_membership_summary",
    language: "en",
  },
  {
    name: "Hebrew referral",
    message: "אפשר קוד חבר מביא חבר?",
    intent: "referral_share",
    expectedTool: "get_referral_share",
    language: "he",
  },
  {
    name: "English opt-out",
    message: "Please stop sending me club promo messages",
    intent: "messaging_opt_out",
    expectedTool: "set_membership_messaging_opt_out",
    language: "en",
  },
];

async function probe(testCase, index) {
  const startedAt = Date.now();
  const requestId = `${runId}-${index + 1}`;
  const response = await fetch(`${apiUrl}/api/v1/agent/debug/membership-intent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({ message: testCase.message }),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  const mismatches = [];
  if (response.status !== 200) mismatches.push(`status expected 200 got ${response.status}`);
  if (body.intent !== testCase.intent) mismatches.push(`intent expected ${testCase.intent} got ${String(body.intent)}`);
  if (body.expectedTool !== testCase.expectedTool) {
    mismatches.push(`tool expected ${testCase.expectedTool} got ${String(body.expectedTool)}`);
  }
  if (body.language !== testCase.language) mismatches.push(`language expected ${testCase.language} got ${String(body.language)}`);
  if (body.confidence !== "high") mismatches.push(`confidence expected high got ${String(body.confidence)}`);

  return {
    name: testCase.name,
    message: testCase.message,
    requestId,
    status: response.status,
    ok: response.ok && mismatches.length === 0,
    elapsedMs: Date.now() - startedAt,
    expected: {
      intent: testCase.intent,
      expectedTool: testCase.expectedTool,
      language: testCase.language,
    },
    observed: body,
    mismatches,
  };
}

const results = [];
for (const [index, testCase] of cases.entries()) {
  results.push(await probe(testCase, index));
}

const passed = results.filter((result) => result.ok).length;
const report = {
  type: "agent-membership-intent",
  status: passed === results.length ? "passed" : "failed",
  runId,
  apiUrl,
  total: results.length,
  passed,
  failed: results.length - passed,
  results,
};

if (artifactPath) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Agent membership intent smoke: ${passed}/${results.length} passed`);
for (const result of results) {
  const detail = result.ok
    ? `intent=${result.observed.intent} tool=${result.observed.expectedTool} lang=${result.observed.language}`
    : result.mismatches.join("; ");
  console.log(`- ${result.ok ? "PASS" : "FAIL"} ${result.name}: ${detail} requestId=${result.requestId}`);
}

if (report.status !== "passed") {
  process.exitCode = 1;
}
