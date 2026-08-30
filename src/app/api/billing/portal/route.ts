import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSubscriptionForUser } from "@/lib/billing/subscription";
import { APP_URL } from "@/lib/branding";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const sub = await getSubscriptionForUser(user.id);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found yet — subscribe first." },
      { status: 409 }
    );
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing] portal session creation failed", err);
    return NextResponse.json(
      { error: "Failed to open the billing portal. Please try again shortly." },
      { status: 502 }
    );
  }
}
