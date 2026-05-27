/**
 * Deterministic WhatsApp membership intent probes.
 *
 * These tests do not call the LLM. They verify the agent debugging layer maps
 * common guest membership phrases to the tool Jake should use.
 */

import * as api from "./api-client.js";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
  durationMs: number;
}

async function runTest(name: string, fn: () => Promise<string>): Promise<TestResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, pass: true, detail, durationMs: Date.now() - start };
  } catch (err) {
    return { name, pass: false, detail: String(err), durationMs: Date.now() - start };
  }
}

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
] as const;

export async function runAgentMembershipIntentTests(): Promise<{ results: TestResult[]; summary: string }> {
  const results: TestResult[] = [];

  for (const testCase of cases) {
    results.push(await runTest(`Membership Intent: ${testCase.name}`, async () => {
      const result = await api.debugMembershipIntent(testCase.message) as {
        intent?: string;
        expectedTool?: string | null;
        language?: string;
        confidence?: string;
      };

      if (result.intent !== testCase.intent) {
        throw new Error(`Expected intent=${testCase.intent}, got ${result.intent}`);
      }
      if (result.expectedTool !== testCase.expectedTool) {
        throw new Error(`Expected tool=${testCase.expectedTool}, got ${result.expectedTool}`);
      }
      if (result.language !== testCase.language) {
        throw new Error(`Expected language=${testCase.language}, got ${result.language}`);
      }
      if (result.confidence !== "high") {
        throw new Error(`Expected high confidence, got ${result.confidence}`);
      }

      return `intent=${result.intent} tool=${result.expectedTool} lang=${result.language}`;
    }));
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const summary = `${passed}/${results.length} passed${failed ? ` (${failed} failed)` : ""}`;
  return { results, summary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { results, summary } = await runAgentMembershipIntentTests();
  console.log(`🧪 Agent Membership Intent Tests — ${new Date().toISOString().slice(0, 16)}`);
  console.log(`Result: ${summary}\n`);

  for (const result of results) {
    console.log(`${result.pass ? "✅" : "❌"} ${result.name} (${result.durationMs}ms)`);
    console.log(`   ${result.detail}`);
  }

  if (results.some((result) => !result.pass)) {
    process.exit(1);
  }
}
