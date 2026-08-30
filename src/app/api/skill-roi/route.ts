import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { computeSkillRoiForUser } from "@/lib/skill-roi/compute";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const summary = await computeSkillRoiForUser(user.id);
  return NextResponse.json(summary);
}
