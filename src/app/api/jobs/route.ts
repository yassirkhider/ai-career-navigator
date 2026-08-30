import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { jobs, jobRequirements, skills, auditLogs } from "@/lib/db/schema";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildJobParserPrompt,
  jobParseSchema,
  JOB_PARSER_NAME,
  JOB_PARSER_VERSION,
} from "@/lib/ai/prompts/jobParserPrompt";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";

const createJobSchema = z.object({
  rawDescription: z.string().min(20, "Please paste the full job description.").max(20_000),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`job-create:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { rawDescription, sourceUrl } = parsed.data;

  const [job] = await db
    .insert(jobs)
    .values({
      userId: user.id,
      title: "Untitled role (parsing...)",
      rawDescription,
      sourceUrl: sourceUrl ?? null,
      parseStatus: "PROCESSING",
    })
    .returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "JOB_CREATED",
    entityType: "job",
    entityId: job.id,
  });

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildJobParserPrompt(rawDescription);
    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: jobParseSchema,
      promptName: JOB_PARSER_NAME,
      promptVersion: JOB_PARSER_VERSION,
      userId: user.id,
    });

    await db
      .update(jobs)
      .set({
        title: data.title.slice(0, 255),
        company: data.company,
        location: data.location,
        workMode: data.workMode,
        employmentType: data.employmentType,
        salary: data.salary,
        parseStatus: "COMPLETED",
      })
      .where(eq(jobs.id, job.id));

    for (const req of data.requirements) {
      let skillId: string | null = null;
      if (req.category === "TECHNICAL_SKILL" || req.category === "TOOL_SOFTWARE") {
        const [existing] = await db
          .select()
          .from(skills)
          .where(eq(skills.name, req.rawText))
          .limit(1);
        if (existing) {
          skillId = existing.id;
        } else {
          const [created] = await db
            .insert(skills)
            .values({ name: req.rawText, category: req.category.toLowerCase() })
            .returning();
          skillId = created.id;
        }
      }

      await db.insert(jobRequirements).values({
        jobId: job.id,
        skillId,
        rawText: req.rawText,
        category: req.category,
        importance: req.importance,
      });
    }

    return NextResponse.json({
      job: { ...job, title: data.title, parseStatus: "COMPLETED" },
      requirements: data.requirements,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI parsing service is currently unavailable. The job was saved; please retry parsing shortly."
        : "Failed to parse job description.";
    await db
      .update(jobs)
      .set({ parseStatus: "FAILED", parseError: message })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ error: message, jobId: job.id }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const userJobs = await db.select().from(jobs).where(eq(jobs.userId, user.id));
  return NextResponse.json({ jobs: userJobs });
}
