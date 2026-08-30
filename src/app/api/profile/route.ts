import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFullCareerProfile } from "@/lib/career-profile/persist";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const profile = await getFullCareerProfile(user.id);
  return NextResponse.json({ profile });
}
