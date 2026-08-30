import "server-only";
import mammoth from "mammoth";

export class CvExtractionError extends Error {}

export async function extractCvText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      // Dynamic import: pdf-parse's module-level code attempts to read a
      // local test file if imported eagerly at build/module-eval time in
      // some bundling setups; dynamic import keeps that self-contained.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text?.trim() ?? "";
      if (!text) {
        throw new CvExtractionError(
          "No extractable text found in this PDF. It may be a scanned image without OCR. " +
            "OCR is not currently configured — please upload a text-based PDF, DOCX, or paste your CV as text."
        );
      }
      return text;
    }

    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) {
        throw new CvExtractionError("No extractable text found in this DOCX file.");
      }
      return text;
    }

    if (mimeType === "text/plain") {
      const text = buffer.toString("utf-8").trim();
      if (!text) {
        throw new CvExtractionError("The uploaded text file is empty.");
      }
      return text;
    }

    throw new CvExtractionError(`Unsupported MIME type: ${mimeType}`);
  } catch (err) {
    if (err instanceof CvExtractionError) throw err;
    // Log the real cause server-side (for `docker compose logs app` /
    // production log aggregation) — the user only ever sees the safe,
    // generic message below, but operators debugging a real failure need
    // the actual error, not just "failed to parse."
    console.error("[cv-parsing] extraction failed:", err);
    throw new CvExtractionError(
      "Failed to parse the uploaded document. It may be corrupted, password-protected, or in an unsupported format."
    );
  }
}
