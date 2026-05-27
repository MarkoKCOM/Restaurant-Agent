export type MembershipIntent =
  | "membership_summary"
  | "referral_share"
  | "messaging_opt_out"
  | "reward_help"
  | "unknown";

export interface MembershipIntentDebugResult {
  intent: MembershipIntent;
  confidence: "high" | "medium" | "low";
  language: "he" | "en" | "ar";
  expectedTool: string | null;
  reason: string;
}

const HEBREW_RANGE = /[\u0590-\u05FF]/;
const ARABIC_RANGE = /[\u0600-\u06FF]/;

function detectLanguage(text: string): MembershipIntentDebugResult["language"] {
  if (HEBREW_RANGE.test(text)) return "he";
  if (ARABIC_RANGE.test(text)) return "ar";
  return "en";
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function debugMembershipIntent(message: string): MembershipIntentDebugResult {
  const normalized = message.trim().toLowerCase();
  const language = detectLanguage(message);

  if (
    hasAny(normalized, [
      /\b(stop|unsubscribe|opt\s*out|remove me|turn off)\b/,
      /אל תשלחו|תפסיקו|הסר|הסרה|לבטל הודעות|בלי הודעות|לא לשלוח/,
    ])
  ) {
    return {
      intent: "messaging_opt_out",
      confidence: "high",
      language,
      expectedTool: "set_membership_messaging_opt_out",
      reason: "guest asked to stop non-transactional membership/promotional messages",
    };
  }

  if (
    hasAny(normalized, [
      /\b(referral|refer|invite|bring a friend|friend code)\b/,
      /חבר מביא חבר|הפני(?:ה|ות)|קוד חבר|להזמין חבר|להביא חבר/,
    ])
  ) {
    return {
      intent: "referral_share",
      confidence: "high",
      language,
      expectedTool: "get_referral_share",
      reason: "guest asked for referral or invite-a-friend information",
    };
  }

  if (
    hasAny(normalized, [
      /\b(reward|claim|redeem|benefit|perk|coupon|available)\b/,
      /הטב(?:ה|ות)|פרס|מימוש|לממש|קופון|זכאי|זכאית|מה מגיע לי/,
    ])
  ) {
    return {
      intent: "reward_help",
      confidence: "high",
      language,
      expectedTool: "get_membership_summary",
      reason: "guest asked about available rewards or claimable benefits",
    };
  }

  if (
    hasAny(normalized, [
      /\b(points?|balance|tier|status|stamps?|membership|member club)\b/,
      /נקודות|יתרה|סטטוס|דרגה|חותמות|מועדון|חבר מועדון/,
    ])
  ) {
    return {
      intent: "membership_summary",
      confidence: "high",
      language,
      expectedTool: "get_membership_summary",
      reason: "guest asked about member balance, tier, stamps, or club status",
    };
  }

  return {
    intent: "unknown",
    confidence: "low",
    language,
    expectedTool: null,
    reason: "message did not match a known membership intent",
  };
}
