"use client";

import { useState } from "react";

interface Props {
  accessLevel: "trial_active" | "paid_active" | "locked";
  daysRemaining: number;
  hasStripeCustomer: boolean;
  checkoutOutcome: "success" | "canceled" | null;
}

export function BillingPanel({ accessLevel, daysRemaining, hasStripeCustomer, checkoutOutcome }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function goToCheckout() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout.");
        setStatus("error");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  async function goToPortal() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to open billing portal.");
        setStatus("error");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      {checkoutOutcome === "success" && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Payment successful — thanks! It may take a moment for your subscription status to update below.
        </div>
      )}
      {checkoutOutcome === "canceled" && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Checkout was canceled — no charge was made.
        </div>
      )}

      {accessLevel === "trial_active" && (
        <>
          <p className="text-lg font-semibold text-slate-900">
            {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left in your free trial
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Subscribe anytime to keep full access after your trial ends.
          </p>
        </>
      )}

      {accessLevel === "paid_active" && (
        <>
          <p className="text-lg font-semibold text-slate-900">You&apos;re subscribed to Premium</p>
          <p className="mt-1 text-sm text-slate-600">Manage your payment method or cancel anytime.</p>
        </>
      )}

      {accessLevel === "locked" && (
        <>
          <p className="text-lg font-semibold text-slate-900">Your trial has ended</p>
          <p className="mt-1 text-sm text-slate-600">
            Subscribe to Premium to keep using AI Career Navigator.
          </p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex gap-3">
        {accessLevel !== "paid_active" && (
          <button
            onClick={goToCheckout}
            disabled={status === "loading"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {status === "loading" ? "Redirecting…" : "Upgrade to Premium"}
          </button>
        )}
        {hasStripeCustomer && (
          <button
            onClick={goToPortal}
            disabled={status === "loading"}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Manage billing
          </button>
        )}
      </div>
    </div>
  );
}
