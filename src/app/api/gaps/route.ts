import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getGapSummaryForUser } from "@/lib/gaps/aggregate";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const summary = await getGapSummaryForUser(user.id);
  return NextResponse.json(summary);
}
