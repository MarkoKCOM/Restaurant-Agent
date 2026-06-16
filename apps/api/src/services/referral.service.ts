import { awardPoints } from "./loyalty.service.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { loyaltyTransactionRepository } from "../repositories/loyalty-transaction.repository.js";

/**
 * Generate a unique 8-character alphanumeric referral code for a guest.
 */
export async function generateReferralCode(guestId: string): Promise<string> {
  const guest = await guestRepository.findById(guestId);

  if (!guest) {
    throw new Error("Guest not found");
  }

  // If guest already has a referral code, return it
  if (guest.referralCode) {
    return guest.referralCode;
  }

  // Generate unique 8-char alphanumeric code
  let code: string;
  let attempts = 0;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

  do {
    code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check uniqueness
    const existing = await guestRepository.findByReferralCode(code);

    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    throw new Error("Failed to generate unique referral code");
  }

  // Save to guest
  await guestRepository.updateById(guestId, { referralCode: code, updatedAt: new Date() });

  return code;
}

/**
 * Apply a referral code for a new guest.
 * Awards referrer 50 points and new guest 25 points.
 */
export async function applyReferral(
  newGuestId: string,
  referralCode: string,
): Promise<{ referrerId: string; referrerName: string }> {
  // Find referrer by code
  const referrer = await guestRepository.findByReferralCode(referralCode);

  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  // Prevent self-referral
  if (referrer.id === newGuestId) {
    throw new Error("Cannot refer yourself");
  }

  // Check new guest exists and hasn't already been referred
  const newGuest = await guestRepository.findById(newGuestId);

  if (!newGuest) {
    throw new Error("Guest not found");
  }

  if (newGuest.referredBy) {
    throw new Error("Guest has already been referred");
  }

  if (newGuest.restaurantId !== referrer.restaurantId) {
    throw new Error("Referral code does not belong to this restaurant");
  }

  // Set referredBy on new guest
  await guestRepository.updateById(newGuestId, { referredBy: referrer.id, updatedAt: new Date() });

  // Award referrer 50 points
  await awardPoints(referrer.id, referrer.restaurantId, 50, "referral_bonus");

  // Award new guest 25 points
  await awardPoints(newGuestId, newGuest.restaurantId, 25, "welcome_bonus");

  return { referrerId: referrer.id, referrerName: referrer.name };
}

/**
 * Get referral stats for a guest (how many people they referred, total points from referrals).
 */
export async function getReferralStats(
  guestId: string,
): Promise<{ referralCount: number; totalPointsEarned: number }> {
  // Count guests referred by this guest
  const referred = await guestRepository.findByReferredBy(guestId);

  const referralCount = referred.length;

  // Sum points earned from referral bonuses
  const transactions = await loyaltyTransactionRepository.listByGuestAndReason(
    guestId,
    "referral_bonus",
  );

  const totalPointsEarned = transactions.reduce((sum, t) => sum + t.points, 0);

  return { referralCount, totalPointsEarned };
}

export interface ReferralShare {
  guestId: string;
  restaurantId: string;
  referralCode: string;
  referralCount: number;
  totalReferralPoints: number;
  benefitSummary: {
    he: string;
    en: string;
  };
  shareMessage: {
    he: string;
    en: string;
  };
}

export async function getReferralShare(guestId: string): Promise<ReferralShare> {
  const guest = await guestRepository.findById(guestId);

  if (!guest) {
    throw new Error("Guest not found");
  }

  const referralCode = await generateReferralCode(guestId);
  const stats = await getReferralStats(guestId);
  const benefitSummary = {
    he: "שתפו את הקוד עם חבר. כשהחבר מצטרף דרך הקוד, המסעדה יכולה לזהות את ההפניה ולתת קרדיט במועדון לפי ההטבה הפעילה.",
    en: "Share the code with a friend. When they join through it, the restaurant can recognize the referral and apply the active club benefit.",
  };

  return {
    guestId,
    restaurantId: guest.restaurantId,
    referralCode,
    referralCount: stats.referralCount,
    totalReferralPoints: stats.totalPointsEarned,
    benefitSummary,
    shareMessage: {
      he: `היי, קיבלתי קוד חבר מביא חבר למועדון: ${referralCode}. אפשר למסור אותו כשמצטרפים או מזמינים מקום.`,
      en: `I have a bring-a-friend club code: ${referralCode}. Share it when joining or booking so the restaurant can recognize the referral.`,
    },
  };
}
