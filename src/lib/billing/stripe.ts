import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Throws if STRIPE_SECRET_KEY is missing rather than silently no-op'ing —
 * billing routes must fail loudly, not pretend to process a payment.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Billing features require a real Stripe account — see .env.example."
    );
  }
  cached = new Stripe(key);
  return cached;
}
