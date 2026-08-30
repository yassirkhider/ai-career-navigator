import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { cvVersions } from "@/lib/db/schema";
import type { CvVersionContent } from "@/lib/ai/prompts/cvRewritePrompt";
import { buildCvDocx } from "@/lib/documents/cvDocx";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { cvVersionId } = await context.params;

  const [version] = await db
    .select()
    .from(cvVersions)
    .where(and(eq(cvVersions.id, cvVersionId), eq(cvVersions.userId, user.id)))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }

  const content = version.content as CvVersionContent;
  const safeFilename = version.versionLabel.replace(/[^a-z0-9-_ ]/gi, "").trim() || "cv";
  const format = req.nextUrl.searchParams.get("format");

  if (format === "docx") {
    const buffer = await buildCvDocx(version.versionLabel, content);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}.docx"`,
      },
    });
  }

  const text = renderPlainText(version.versionLabel, content);
  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}.txt"`,
    },
  });
}

function renderPlainText(label: string, content: CvVersionContent): string {
  const lines: string[] = [];
  lines.push(label.toUpperCase());
  lines.push("=".repeat(label.length));
  lines.push("");
  lines.push("PROFESSIONAL SUMMARY");
  lines.push(content.professionalSummary);
  lines.push("");
  lines.push("WORK EXPERIENCE");
  for (const exp of content.workExperience) {
    lines.push(`${exp.jobTitle} — ${exp.employer}`);
    for (const bullet of exp.bullets) {
      lines.push(`  • ${bullet}`);
    }
    lines.push("");
  }
  lines.push("SKILLS");
  lines.push(content.skillsHighlighted.join(", "));
  return lines.join("\n");
}
