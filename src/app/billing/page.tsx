import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSubscriptionForUser } from "@/lib/billing/subscription";
import { getAccessLevel, daysRemainingInTrial } from "@/lib/billing/access";
import { BillingPanel } from "@/components/BillingPanel";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { checkout } = await searchParams;
  const sub = await getSubscriptionForUser(user.id);

  const snapshot = sub
    ? { status: sub.status, trialEndsAt: sub.trialEndsAt, currentPeriodEnd: sub.currentPeriodEnd }
    : null;
  const accessLevel = getAccessLevel(snapshot);
  const daysRemaining = snapshot ? daysRemainingInTrial(snapshot) : 0;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
      <p className="mt-1 text-slate-600">AI Career Navigator Premium — full access to every feature.</p>

      <div className="mt-6">
        <BillingPanel
          accessLevel={accessLevel}
          daysRemaining={daysRemaining}
          hasStripeCustomer={Boolean(sub?.stripeCustomerId)}
          checkoutOutcome={checkout === "success" ? "success" : checkout === "canceled" ? "canceled" : null}
        />
      </div>
    </main>
  );
}
