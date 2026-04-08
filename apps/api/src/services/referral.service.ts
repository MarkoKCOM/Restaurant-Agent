import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, loyaltyTransactions } from "../db/schema.js";
import { awardPoints } from "./loyalty.service.js";

/**
 * Generate a unique 8-character alphanumeric referral code for a guest.
 */
export async function generateReferralCode(guestId: string): Promise<string> {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

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
    const [existing] = await db
      .select({ id: guests.id })
      .from(guests)
      .where(eq(guests.referralCode, code))
      .limit(1);

    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    throw new Error("Failed to generate unique referral code");
  }

  // Save to guest
  await db
    .update(guests)
    .set({ referralCode: code, updatedAt: new Date() })
    .where(eq(guests.id, guestId));

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
  const [referrer] = await db
    .select()
    .from(guests)
    .where(eq(guests.referralCode, referralCode))
    .limit(1);

  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  // Prevent self-referral
  if (referrer.id === newGuestId) {
    throw new Error("Cannot refer yourself");
  }

  // Check new guest exists and hasn't already been referred
  const [newGuest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, newGuestId))
    .limit(1);

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
  await db
    .update(guests)
    .set({ referredBy: referrer.id, updatedAt: new Date() })
    .where(eq(guests.id, newGuestId));

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
  const referred = await db
    .select({ id: guests.id })
    .from(guests)
    .where(eq(guests.referredBy, guestId));

  const referralCount = referred.length;

  // Sum points earned from referral bonuses
  const transactions = await db
    .select({ points: loyaltyTransactions.points })
    .from(loyaltyTransactions)
    .where(
      sql`${loyaltyTransactions.guestId} = ${guestId} AND ${loyaltyTransactions.reason} = 'referral_bonus'`,
    );

  const totalPointsEarned = transactions.reduce((sum, t) => sum + t.points, 0);

  return { referralCount, totalPointsEarned };
}
