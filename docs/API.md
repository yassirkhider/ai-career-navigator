# API

All routes are under `/api`, all require a valid session cookie except
`register`/`login`, and all return JSON. Authentication failures return
`401`; authorization/ownership failures return `404` (not `403`) for
resource routes to avoid confirming another user's resource exists, and
`403` for admin routes.

## Auth

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/register | none | body: email, password, name? -> creates account + session |
| POST | /api/auth/login | none | body: email, password; rate-limited 10/min/IP |
| POST | /api/auth/logout | session | deletes the server-side session row |
| GET | /api/auth/me | optional | returns { user: null } if not logged in |

## Career Profile

| Method | Route | Notes |
|---|---|---|
| POST | /api/cv/upload | multipart form, `file` field, PDF/DOCX/TXT under 10MB - extracts text, AI-parses, persists |
| GET | /api/profile | full Master Career Profile (experience, education, certs, skills, languages) |
| PATCH | /api/profile/skills/:profileSkillId | edit proficiency/years/last-used/verified on one skill |

## Jobs and Job Fit

| Method | Route | Notes |
|---|---|---|
| POST | /api/jobs | body: rawDescription, sourceUrl? - AI-parses into structured requirements |
| GET | /api/jobs | list the user's jobs |
| POST | /api/jobs/:jobId/analyze | runs the Job Fit Engine against the Master Career Profile |
| POST, GET | /api/jobs/:jobId/similar-roles | generate / fetch latest similar-role suggestions |

## Gaps and Skill ROI

| Method | Route | Notes |
|---|---|---|
| GET | /api/gaps | aggregated, classified, prioritized gap list across all analyzed jobs |
| GET | /api/skill-roi | recurring-skill demand frequency + recommended learning order |

## Learning

| Method | Route | Notes |
|---|---|---|
| POST | /api/learning-recommendations | body: skillName, context? - see honesty notes in docs/AI_ARCHITECTURE.md |
| GET | /api/learning-recommendations | list generated batches |

## CV Builder

| Method | Route | Notes |
|---|---|---|
| POST | /api/cv-versions | body: jobId?, versionLabel? - generate a targeted or general CV |
| GET | /api/cv-versions | list versions |
| GET, PATCH, DELETE | /api/cv-versions/:cvVersionId | fetch / rename / delete |
| GET | /api/cv-versions/:cvVersionId/export | plain-text by default; `?format=docx` for a real Word (.docx) document |
| POST, GET | /api/cv-versions/:cvVersionId/ats-analysis | run / fetch latest ATS estimate against a job |

## Cover Letters

| Method | Route | Notes |
|---|---|---|
| POST | /api/cover-letters | body: jobId, tone? - PROFESSIONAL / EXECUTIVE / CONCISE / TECHNICAL |
| GET | /api/cover-letters | list |
| GET, PATCH, DELETE | /api/cover-letters/:coverLetterId | fetch / hand-edit body / delete |
| GET | /api/cover-letters/:coverLetterId/export | plain-text by default; `?format=docx` for a real Word (.docx) document |

## Interview Coach

| Method | Route | Notes |
|---|---|---|
| POST | /api/interview-sessions | body: jobId - generates 6-12 questions across 6 types |
| GET | /api/interview-sessions | list sessions |
| GET | /api/interview-sessions/:sessionId | questions + latest answer each |
| POST | /api/interview-sessions/:sessionId/answers | body: questionId, answerText - scores across 6 dimensions |

## Career Path and LinkedIn

| Method | Route | Notes |
|---|---|---|
| POST, GET | /api/career-path | generate / fetch latest career path prediction |
| POST, GET | /api/linkedin-optimizer | generate / fetch latest LinkedIn content suggestions |

## Applications

| Method | Route | Notes |
|---|---|---|
| POST | /api/applications | body: jobId?, jobTitle, company?, status?, notes? |
| GET | /api/applications | list |
| PATCH, DELETE | /api/applications/:applicationId | update any field (incl. status, logged with from/to) / delete |

## Admin (requires role = ADMIN)

| Method | Route | Notes |
|---|---|---|
| GET | /api/admin/users | account metadata only (never career documents) + system stats |
| PATCH | /api/admin/users/:userId | body: role?, suspended? - cannot target self |
| GET | /api/admin/audit-logs | most recent 200 audit entries |

## Common error shape

```json
{ "error": "Human-readable message.", "details": { } }
```

`details` is only present on 400s where Zod validation failed, and
contains the result of `.flatten()` on the ZodError.
