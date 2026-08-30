export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
}

export type AccessLevel = "trial_active" | "paid_active" | "locked";

/**
 * Single source of truth for "does this user get into the app right now".
 * Pure function — no DB, no network — so it's fully unit-testable and the
 * exact same logic is used both server-side (route/layout gating) and can
 * be reused client-side for UI messaging without duplicating the rules.
 */
export function getAccessLevel(sub: SubscriptionSnapshot | null, now: Date = new Date()): AccessLevel {
  if (!sub) return "locked";

  if (sub.status === "ACTIVE" || sub.status === "PAST_DUE") {
    // PAST_DUE still grants access for a grace period — Stripe will retry
    // the payment and fire another webhook; we don't hard-lock on the
    // first missed payment, only once Stripe tells us it's truly CANCELED.
    return "paid_active";
  }

  if (sub.status === "TRIALING") {
    return sub.trialEndsAt.getTime() > now.getTime() ? "trial_active" : "locked";
  }

  // CANCELED, EXPIRED
  return "locked";
}

export function daysRemainingInTrial(sub: SubscriptionSnapshot, now: Date = new Date()): number {
  const msRemaining = sub.trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

export const TRIAL_LENGTH_DAYS = 3;

export function computeTrialEndDate(startDate: Date = new Date()): Date {
  return new Date(startDate.getTime() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
}
