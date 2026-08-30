import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";
import type { CvVersionContent } from "@/lib/ai/prompts/cvRewritePrompt";

// US Letter in DXA (1440 = 1 inch) — docx defaults to A4 otherwise.
const US_LETTER = { width: 12240, height: 15840 };

const BULLET_NUMBERING_REFERENCE = "cv-bullets";

export async function buildCvDocx(label: string, content: CvVersionContent): Promise<Buffer> {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_NUMBERING_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: US_LETTER },
        },
        children: [
          new Paragraph({
            text: label,
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            text: "Professional Summary",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [new TextRun(content.professionalSummary)],
          }),
          new Paragraph({
            text: "Work Experience",
            heading: HeadingLevel.HEADING_1,
          }),
          ...content.workExperience.flatMap((exp) => [
            new Paragraph({
              children: [
                new TextRun({ text: exp.jobTitle, bold: true }),
                new TextRun({ text: ` — ${exp.employer}`, bold: true }),
              ],
            }),
            ...exp.bullets.map(
              (bullet) =>
                new Paragraph({
                  numbering: { reference: BULLET_NUMBERING_REFERENCE, level: 0 },
                  children: [new TextRun(bullet)],
                })
            ),
          ]),
          new Paragraph({
            text: "Skills",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [new TextRun(content.skillsHighlighted.join(", "))],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
