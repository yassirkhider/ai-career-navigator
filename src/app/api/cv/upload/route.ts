import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { getStorageProvider, validateUpload } from "@/lib/storage";
import { extractCvText, CvExtractionError } from "@/lib/cv-parsing/extract";
import { db } from "@/lib/db/client";
import { cvDocuments, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildCareerProfileParserPrompt,
  careerProfileSchema,
  CAREER_PROFILE_PARSER_NAME,
  CAREER_PROFILE_PARSER_VERSION,
} from "@/lib/ai/prompts/careerProfileParserPrompt";
import { persistCareerProfileExtraction } from "@/lib/career-profile/persist";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`cv-upload:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const validationError = validateUpload({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { storedFilename, storagePath } = await storage.save(buffer, {
    originalFilename: file.name,
    mimeType: file.type,
  });

  const [cvDoc] = await db
    .insert(cvDocuments)
    .values({
      userId: user.id,
      originalFilename: file.name.slice(0, 255),
      storedFilename,
      mimeType: file.type,
      fileSizeBytes: file.size,
      storagePath,
      parseStatus: "PROCESSING",
    })
    .returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "CV_UPLOADED",
    entityType: "cv_document",
    entityId: cvDoc.id,
  });

  // Extract raw text
  let rawText: string;
  try {
    rawText = await extractCvText(buffer, file.type);
  } catch (err) {
    const message =
      err instanceof CvExtractionError ? err.message : "Failed to extract text from document.";
    await db
      .update(cvDocuments)
      .set({ parseStatus: "FAILED", parseError: message })
      .where(eq(cvDocuments.id, cvDoc.id));
    return NextResponse.json(
      { error: message, cvDocumentId: cvDoc.id },
      { status: 422 }
    );
  }

  await db
    .update(cvDocuments)
    .set({ extractedRawText: rawText })
    .where(eq(cvDocuments.id, cvDoc.id));

  // AI structured extraction. Text inside <document> tags is treated as
  // untrusted data by the prompt (see careerProfileParserPrompt.ts) —
  // this is the prompt-injection defense for uploaded CV content.
  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildCareerProfileParserPrompt(rawText);
    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: careerProfileSchema,
      promptName: CAREER_PROFILE_PARSER_NAME,
      promptVersion: CAREER_PROFILE_PARSER_VERSION,
      userId: user.id,
    });

    await persistCareerProfileExtraction(user.id, data);

    await db
      .update(cvDocuments)
      .set({ parseStatus: "COMPLETED" })
      .where(eq(cvDocuments.id, cvDoc.id));

    return NextResponse.json({
      cvDocumentId: cvDoc.id,
      status: "COMPLETED",
      extraction: data,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI parsing service is currently unavailable. Your CV was uploaded and its text was extracted — please try parsing again shortly."
        : "Failed to parse CV content into a structured profile.";
    await db
      .update(cvDocuments)
      .set({ parseStatus: "FAILED", parseError: message })
      .where(eq(cvDocuments.id, cvDoc.id));
    return NextResponse.json({ error: message, cvDocumentId: cvDoc.id }, { status: 502 });
  }
}
