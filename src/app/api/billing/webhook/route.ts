import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptions, auditLogs } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/billing/stripe";
import { mapStripeStatus } from "@/lib/billing/subscription";

/**
 * Applies the current state of a Stripe subscription object to our DB row.
 * Looked up by userId (from subscription metadata, set at checkout
 * creation) rather than by stripeSubscriptionId, since every user already
 * has exactly one subscription row created at registration — we always
 * UPDATE that row, never insert a second one.
 */
async function syncSubscriptionFromStripe(stripeSub: Stripe.Subscription, userId: string | undefined) {
  if (!userId) {
    console.error("[billing webhook] Stripe subscription event missing userId metadata", stripeSub.id);
    return;
  }

  const item = stripeSub.items.data[0];
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  await db
    .update(subscriptions)
    .set({
      status: mapStripeStatus(stripeSub.status),
      currentPeriodEnd,
      stripeCustomerId:
        typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: item?.price?.id ?? null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })
    .where(eq(subscriptions.userId, userId));

  await db.insert(auditLogs).values({
    userId,
    action: "SUBSCRIPTION_SYNCED",
    entityType: "subscription",
    entityId: stripeSub.id,
    metadata: { stripeStatus: stripeSub.status },
  });
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[billing webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Signature verification requires the exact raw request body — never
  // JSON.parse before this step, or the signature check will fail (and if
  // it were skipped, anyone could POST fake "payment succeeded" events).
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[billing webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
        if (session.subscription && userId) {
          const stripe = getStripeClient();
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const stripeSub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionFromStripe(stripeSub, userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(stripeSub, stripeSub.metadata?.userId);
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const userId = stripeSub.metadata?.userId;
        if (userId) {
          await db
            .update(subscriptions)
            .set({ status: "CANCELED" })
            .where(eq(subscriptions.userId, userId));
        }
        break;
      }
      default:
        // Other event types are intentionally ignored — Stripe sends many
        // event types we don't need to react to.
        break;
    }
  } catch (err) {
    console.error("[billing webhook] handler error", err);
    // Return 500 so Stripe retries delivery, rather than silently dropping
    // an event we failed to process.
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
