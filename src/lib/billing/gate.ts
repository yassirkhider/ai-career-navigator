import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessLevelForUser } from "./subscription";

/**
 * Call at the top of any protected page (after the existing
 * getCurrentUser()-based login redirect). Admins are exempt — they
 * shouldn't be locked out of the platform they administer by their own
 * trial lapsing.
 */
export async function requireActiveAccessPage(userId: string, role: string) {
  if (role === "ADMIN") return;
  const level = await getAccessLevelForUser(userId);
  if (level === "locked") {
    redirect("/billing");
  }
}

/**
 * Call at the top of any API route that triggers real AI spend. Returns a
 * NextResponse to return immediately if access is locked, or null if the
 * caller should proceed. This is the layer that actually stops a locked-out
 * user from bypassing the UI gate by calling the API directly — the page
 * redirect alone only stops normal browser navigation.
 */
export async function requireActiveAccessApi(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (user.role === "ADMIN") return null;

  const level = await getAccessLevelForUser(user.id);
  if (level === "locked") {
    return NextResponse.json(
      { error: "Your trial has ended. Subscribe to continue using AI features.", code: "SUBSCRIPTION_REQUIRED" },
      { status: 402 }
    );
  }
  return null;
}
