import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { coverLetters } from "@/lib/db/schema";
import { buildCoverLetterDocx } from "@/lib/documents/coverLetterDocx";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ coverLetterId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { coverLetterId } = await context.params;

  const [letter] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.id, coverLetterId), eq(coverLetters.userId, user.id)))
    .limit(1);

  if (!letter) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  const safeFilename = (letter.subject || "cover-letter").replace(/[^a-z0-9-_ ]/gi, "").trim() || "cover-letter";
  const format = req.nextUrl.searchParams.get("format");

  if (format === "docx") {
    const buffer = await buildCoverLetterDocx(letter.subject, letter.body);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}.docx"`,
      },
    });
  }

  const text = `Subject: ${letter.subject ?? ""}\n\n${letter.body}`;
  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}.txt"`,
    },
  });
}
