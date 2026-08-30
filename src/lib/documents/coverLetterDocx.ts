import "server-only";
import { Document, Packer, Paragraph, TextRun } from "docx";

const US_LETTER = { width: 12240, height: 15840 };

export async function buildCoverLetterDocx(subject: string | null, body: string): Promise<Buffer> {
  // The `docx` library gotcha: never use \n inside a TextRun — each line
  // must be its own Paragraph, or line breaks are silently dropped.
  const paragraphs = body.split("\n");

  const doc = new Document({
    sections: [
      {
        properties: { page: { size: US_LETTER } },
        children: [
          ...(subject
            ? [
                new Paragraph({
                  children: [new TextRun({ text: subject, bold: true })],
                }),
                new Paragraph({ children: [] }),
              ]
            : []),
          ...paragraphs.map(
            (line) =>
              new Paragraph({
                children: line ? [new TextRun(line)] : [],
              })
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
