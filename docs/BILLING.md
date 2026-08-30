# Billing

Single "Premium" plan, 3-day free trial starting at registration, gated
via Stripe Checkout + Billing Portal.

## How it works

1. **Registration** (`src/app/api/auth/register/route.ts`) calls
   `startTrialForUser()`, creating a `subscriptions` row with
   `status = TRIALING` and `trial_ends_at = now + 3 days`. Every real user
   has exactly one subscription row from the moment they sign up.
2. **Access is decided by one pure function**: `getAccessLevel()` in
   `src/lib/billing/access.ts` — no DB, no network, fully unit-tested
   (`access.test.ts`). Given a subscription snapshot and the current time,
   it returns `trial_active`, `paid_active`, or `locked`. `PAST_DUE` still
   grants access (a grace period while Stripe retries a failed payment);
   only `CANCELED`/`EXPIRED`/an absent row locks.
3. **Two independent enforcement layers**, both calling the same
   underlying logic:
   - `requireActiveAccessPage()` — called at the top of every protected
     page, redirects to `/billing` if locked
   - `requireActiveAccessApi()` — called at the top of every API route
     that triggers real AI spend, returns `402 Payment Required` if locked

   The API layer exists because the page-level redirect alone only stops
   normal browser navigation — a locked-out user could otherwise keep
   calling API routes directly and still burn real AI compute for free.
   Both layers exempt `role = ADMIN` users.
4. **Upgrade flow**: `/billing` -> "Upgrade to Premium" -> `POST
   /api/billing/checkout` creates a Stripe Checkout Session and redirects
   the browser to Stripe's hosted payment page -> on success, Stripe
   redirects back to `/billing?checkout=success` and fires a
   `checkout.session.completed` webhook that updates the subscription row
   to `ACTIVE`.
5. **Managing/canceling**: "Manage billing" -> `POST /api/billing/portal`
   opens the Stripe Billing Portal (hosted by Stripe — no card data ever
   touches this codebase).

## Why Stripe Checkout/Portal, not a custom payment form

Never build a custom card-entry form — that pulls the app into PCI-DSS
scope for no benefit. Stripe Checkout and the Billing Portal are hosted,
PCI-compliant pages Stripe controls; this app never sees a card number.

## Webhook events handled

| Event | Effect |
|---|---|
| checkout.session.completed | fetches the new Stripe subscription, syncs status/customer/price/period-end onto the user's row |
| customer.subscription.updated / .created | re-syncs status (handles plan changes, renewals, Stripe-side status transitions) |
| customer.subscription.deleted | sets status to CANCELED |

All other Stripe event types are intentionally ignored. Signature
verification (`stripe.webhooks.constructEvent`) always runs against the
**raw** request body — never parse the body as JSON before this step, or
verification will fail (and skipping it would let anyone POST forged
"payment succeeded" events).

## Known limitation: this was not tested against live Stripe

`stripe.com`/`api.stripe.com` were not reachable from the sandbox this
project was built in (only npm/pip/GitHub registries were whitelisted).
The checkout/portal/webhook code was written carefully and reviewed
against Stripe's documented API shapes and the installed `stripe` SDK's
TypeScript types (which did type-check cleanly against the code as
written), but **no real checkout session has actually been created or
completed, and no real webhook has actually been received and verified,
in this environment.**

What *was* verified for real, against a running app and database:
- Trial creation at registration (correct trial_ends_at, correct status)
- Full-access behavior during an active trial (pages load, AI API calls
  succeed)
- Full-lockout behavior once trial_ends_at is in the past (dashboard
  redirects to /billing, /billing itself doesn't redirect-loop, AI API
  calls return 402) — tested by directly setting a test user's
  trial_ends_at into the past in Postgres and re-testing
- Admin exemption from the gate (an admin with no subscription row at all
  still gets full access)
- Per-user isolation (locking one user doesn't affect another)
- The backfill script (scripts/backfill-subscriptions.ts), run for real
  against the dev database, correctly identified users without a
  subscription row, created trials for them, and was confirmed idempotent
  on a second run

**Before going live**: create a Stripe account, a Product + recurring
Price for Premium, a webhook endpoint pointed at
`<APP_URL>/api/billing/webhook`, set the three STRIPE_* env vars (see
`.env.example`), and run through a real test-mode checkout
(4242 4242 4242 4242 is Stripe's standard test card) before accepting
real payments.

## Setting your price

The dollar amount is never in this codebase — it lives on the Stripe
Price object you create in the Stripe Dashboard, referenced here only by
its ID (STRIPE_PRICE_ID). Change the price in Stripe; no code deploy
needed.
