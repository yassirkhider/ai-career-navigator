import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSubscriptionForUser } from "@/lib/billing/subscription";
import { checkRateLimit } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/branding";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rl = checkRateLimit(`billing-checkout:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Set STRIPE_PRICE_ID to enable upgrades." },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripeClient();
    const sub = await getSubscriptionForUser(user.id);
    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Reuse the existing Stripe customer if this user already has one
      // (e.g. re-subscribing after a cancellation) rather than creating a
      // duplicate customer record in Stripe.
      customer: sub?.stripeCustomerId ?? undefined,
      customer_email: sub?.stripeCustomerId ? undefined : userRow?.email,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      success_url: `${APP_URL}/billing?checkout=success`,
      cancel_url: `${APP_URL}/billing?checkout=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing] checkout session creation failed", err);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again shortly." },
      { status: 502 }
    );
  }
}
