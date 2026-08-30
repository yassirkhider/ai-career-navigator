import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { computeTrialEndDate, getAccessLevel, type AccessLevel } from "./access";

/**
 * Called once at registration. Every user gets a TRIALING subscription row
 * immediately — there is no "no subscription" state for a real account
 * (getAccessLevel treats a genuinely missing row as locked, which should
 * only happen for data-integrity edge cases, not normal signups).
 */
export async function startTrialForUser(userId: string) {
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId,
      status: "TRIALING",
      trialEndsAt: computeTrialEndDate(),
    })
    .returning();
  return sub;
}

export async function getSubscriptionForUser(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return sub ?? null;
}

export async function getAccessLevelForUser(userId: string): Promise<AccessLevel> {
  const sub = await getSubscriptionForUser(userId);
  if (!sub) return "locked";
  return getAccessLevel({
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
}

/** Maps a Stripe subscription status string to our internal enum. */
export function mapStripeStatus(
  stripeStatus: string
): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" {
  switch (stripeStatus) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "EXPIRED";
  }
}
