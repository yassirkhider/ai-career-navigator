# AI Architecture

## Provider abstraction

Nothing outside `src/lib/ai/` calls a vendor SDK or hits a vendor API
directly. All AI calls go through:

```ts
import { getAIProvider } from "@/lib/ai";

const provider = getAIProvider();
const { data, usage } = await provider.generateStructured({
  systemPrompt,
  userPrompt,
  schema: someZodSchema,
  promptName: "...",
  promptVersion: "...",
  userId,
});
```

`getAIProvider()` returns:
- **`AnthropicProvider`** (`src/lib/ai/providers/anthropic.ts`) when
  `ANTHROPIC_API_KEY` is set — real calls to `api.anthropic.com`, with
  timeout (60s), retry (up to 2 attempts with exponential backoff, retrying
  on 429/5xx and on Zod validation failure by feeding the error back to the
  model for self-correction), and per-call telemetry written to
  `ai_interactions`.
- **`DevMockProvider`** (`src/lib/ai/providers/dev-mock.ts`) when no key is
  set and `NODE_ENV !== "production"` — throws if instantiated in
  production. This is NOT a simulated feature; it exists because the
  original build environment had no path to obtain an API key, and it
  produces clearly-labeled, deterministic, rule-based output (string
  matching, keyword overlap, template filling) so the request/response
  pipeline, DB writes, and UI rendering could be verified end-to-end
  without a real model call. Every dev-mock response includes
  `[dev-mock heuristic]` in its text output and the model name is always
  `*-mock-*`, which the UI checks to show a visible disclaimer.

Adding a second real provider (OpenAI, etc.) means implementing the
`AIProvider` interface in a new file under `providers/` and branching in
`getAIProvider()` — no other code changes.

## Prompt modules

Each AI feature has its own file under `src/lib/ai/prompts/`, exporting:
- A versioned `..._NAME` / `..._VERSION` pair (for the `ai_interactions`
  and per-feature audit trail)
- A Zod schema describing the exact structured output expected
- A `build...Prompt(...)` function returning `{ systemPrompt, userPrompt }`

Current prompt modules: `careerProfileParserPrompt`, `jobParserPrompt`,
`jobFitPrompt`, `cvRewritePrompt`, `atsAnalysisPrompt`, `coverLetterPrompt`,
`interviewQuestionsPrompt`, `interviewScoringPrompt`, `careerPathPrompt`,
`linkedinOptimizerPrompt`, `similarJobsPrompt`, `courseRecommendationsPrompt`.

## Anti-hallucination pattern

Every prompt that touches candidate data includes an explicit "never
invent X" block naming the specific things that must never be fabricated
for that feature (qualifications, employment history, metrics, specific
course URLs, etc.), and instructs the model to say so explicitly rather
than filling gaps. This is enforced by instruction, not by code — a real
model can still fail to follow instructions perfectly. Two structural
mitigations reduce blast radius:
1. Every AI-extracted skill/fact is stored with `evidence_text`/
   `raw_source_text` pointing back to real CV text, so a human can audit
   it against the source
2. The Learning Engine's URL rule (below) removes an entire category of
   possible fabrication (broken/invented course links) by construction

## Prompt-injection defense

CVs and job postings are untrusted input. Every prompt wraps such content
in `<document>` tags with an explicit instruction that content inside
those tags is data, never commands, even if it looks like an instruction
("ignore previous instructions...", etc.). This was tested against a CV
containing an embedded injection attempt during development — the
pipeline correctly routed it through the parser as inert text.

This is instruction-level defense against a real model, which is the
correct layer for this kind of untrusted natural-language content; it
cannot be perfectly guaranteed against an adversarial or jailbroken model,
which is why structural safeguards (schema validation, ownership/IDOR
checks, rate limiting) exist independently as defense in depth.

## Course-recommendation honesty design

The Learning Recommendation Engine (`courseRecommendationsPrompt.ts`)
explicitly forbids the model from inventing a specific course-detail URL,
since it cannot verify one is currently live. It's restricted to a
provider's stable homepage/search URL instead (e.g.
`https://www.coursera.org/search?query=...`), which resolves correctly
even as specific courses change over time. Every recommendation is stored
with `verified = false` and `last_verified_date = null` as explicit,
separate database columns — not a claim buried in JSON that code could
silently lose track of. A real catalog-API-backed `CourseProvider` (see
`src/lib/learning/types.ts`) can be added later behind the same interface
to eventually set `verified = true`.
