/**
 * Run once, after deploying the billing/subscription feature to an
 * environment that already has real users (created before subscriptions
 * existed). Gives every such user a fresh TRIALING subscription instead of
 * leaving them instantly locked out (the access-gate treats "no
 * subscription row" as locked — correct for a genuinely broken state, but
 * not what you want for pre-existing legitimate users on migration day).
 *
 * Safe to re-run: only inserts for users that don't already have a row.
 *
 * Usage:
 *   DATABASE_URL=<prod-url> npx tsx scripts/backfill-subscriptions.ts
 */
import { db } from "../src/lib/db/client";
import { users, subscriptions } from "../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { computeTrialEndDate } from "../src/lib/billing/access";

async function main() {
  const usersWithoutSubscription = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(isNull(subscriptions.id));

  if (usersWithoutSubscription.length === 0) {
    console.log("No users need backfilling — every user already has a subscription row.");
    return;
  }

  console.log(`Backfilling a fresh trial for ${usersWithoutSubscription.length} user(s)...`);

  for (const user of usersWithoutSubscription) {
    await db.insert(subscriptions).values({
      userId: user.id,
      status: "TRIALING",
      trialEndsAt: computeTrialEndDate(),
    });
    console.log(`  + ${user.email}`);
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
