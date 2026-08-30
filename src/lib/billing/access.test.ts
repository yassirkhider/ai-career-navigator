import { describe, it, expect } from "vitest";
import { getAccessLevel, daysRemainingInTrial, computeTrialEndDate, TRIAL_LENGTH_DAYS } from "./access";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("getAccessLevel", () => {
  it("locks access when there is no subscription record at all", () => {
    expect(getAccessLevel(null, NOW)).toBe("locked");
  });

  it("grants trial access while trialEndsAt is in the future", () => {
    const sub = {
      status: "TRIALING" as const,
      trialEndsAt: new Date(NOW.getTime() + 60_000),
      currentPeriodEnd: null,
    };
    expect(getAccessLevel(sub, NOW)).toBe("trial_active");
  });

  it("locks access the instant trialEndsAt has passed", () => {
    const sub = {
      status: "TRIALING" as const,
      trialEndsAt: new Date(NOW.getTime() - 1),
      currentPeriodEnd: null,
    };
    expect(getAccessLevel(sub, NOW)).toBe("locked");
  });

  it("grants access for ACTIVE status regardless of trialEndsAt", () => {
    const sub = {
      status: "ACTIVE" as const,
      trialEndsAt: new Date(NOW.getTime() - 999_999_999),
      currentPeriodEnd: new Date(NOW.getTime() + 1_000_000),
    };
    expect(getAccessLevel(sub, NOW)).toBe("paid_active");
  });

  it("grants a grace period for PAST_DUE (Stripe is still retrying payment)", () => {
    const sub = {
      status: "PAST_DUE" as const,
      trialEndsAt: new Date(NOW.getTime() - 999_999_999),
      currentPeriodEnd: new Date(NOW.getTime() - 1_000),
    };
    expect(getAccessLevel(sub, NOW)).toBe("paid_active");
  });

  it("locks access for CANCELED", () => {
    const sub = {
      status: "CANCELED" as const,
      trialEndsAt: new Date(NOW.getTime() + 999_999_999),
      currentPeriodEnd: null,
    };
    expect(getAccessLevel(sub, NOW)).toBe("locked");
  });

  it("locks access for EXPIRED", () => {
    const sub = {
      status: "EXPIRED" as const,
      trialEndsAt: new Date(NOW.getTime() + 999_999_999),
      currentPeriodEnd: null,
    };
    expect(getAccessLevel(sub, NOW)).toBe("locked");
  });
});

describe("daysRemainingInTrial", () => {
  it("rounds up partial days so the last day still shows '1 day left'", () => {
    const sub = {
      status: "TRIALING" as const,
      trialEndsAt: new Date(NOW.getTime() + 60_000), // 1 minute left
      currentPeriodEnd: null,
    };
    expect(daysRemainingInTrial(sub, NOW)).toBe(1);
  });

  it("never returns a negative number once expired", () => {
    const sub = {
      status: "TRIALING" as const,
      trialEndsAt: new Date(NOW.getTime() - 999_999_999),
      currentPeriodEnd: null,
    };
    expect(daysRemainingInTrial(sub, NOW)).toBe(0);
  });
});

describe("computeTrialEndDate", () => {
  it("adds exactly TRIAL_LENGTH_DAYS days", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = computeTrialEndDate(start);
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(TRIAL_LENGTH_DAYS);
  });
});
