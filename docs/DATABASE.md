# Database

PostgreSQL, schema defined in `src/lib/db/schema.ts` (Drizzle ORM), migrations
in `drizzle/`. 27 tables as of this writing.

## Migration workflow

```bash
# After editing schema.ts, generate a new SQL migration:
npx drizzle-kit generate

# Apply pending migrations:
npx drizzle-kit migrate

# Inspect the DB directly (dev):
psql "$DATABASE_URL"
```

Never hand-edit generated files in `drizzle/`. Never use `drizzle-kit push`
against production — it applies schema changes without a reviewable
migration file. Always `generate` then `migrate`.

## Core entity groups

- **Auth**: `users`, `sessions`
- **Master Career Profile**: `career_profiles`, `work_experiences`,
  `educations`, `certifications`, `skills`, `profile_skills`,
  `profile_languages` — `profile_skills.evidence_text` holds the
  verbatim/near-verbatim CV text supporting each skill (anti-hallucination
  traceability)
- **CV documents**: `cv_documents` (uploaded files + parse status)
- **Jobs**: `jobs`, `job_requirements`
- **Job Fit**: `job_analyses`, `requirement_matches`
- **CV Builder**: `cv_versions`
- **ATS Analysis**: `ats_analyses`
- **Cover Letters**: `cover_letters`
- **Interview Coach**: `interview_sessions`, `interview_questions`,
  `interview_answers` (answers are append-only — retries create new rows
  rather than overwriting, so progress over time is visible)
- **Applications**: `applications`
- **Career Path**: `career_path_predictions`
- **LinkedIn**: `linkedin_optimizations`
- **Similar Jobs**: `similar_job_suggestions`
- **Learning**: `course_recommendation_batches` (`verified`/`last_verified_date`
  columns are explicit, separate DB columns — always `false`/`null` until a
  real catalog-API-backed provider replaces the current AI-general-knowledge
  one; see `docs/AI_ARCHITECTURE.md`)
- **Observability**: `ai_interactions`, `audit_logs`

## Conventions

- Every table has `created_at`; most have `updated_at` via `$onUpdate`
- IDs are `cuid2` strings, not auto-increment integers (avoids ID
  enumeration, works well with distributed generation)
- Soft-deletion (`deleted_at`) is used for `users` and `cv_documents`; most
  other tables use hard deletion since spec calls for genuine removal
  (e.g. Application Tracker "Delete") — see each route's IDOR checks for
  which pattern applies where
- Foreign keys mostly `onDelete: cascade`; a few (`applications.job_id`,
  `cv_versions.job_id`) use `onDelete: set null` so a tracked application
  or generated CV survives the deletion of the job it referenced

## Backup / restore (operational guidance)

This project does not implement its own backup tooling — use your
Postgres host's standard mechanism:

- **Managed Postgres (RDS/Cloud SQL/Neon/Supabase/etc.)**: use the
  provider's automated daily snapshots + point-in-time recovery. This is
  almost always preferable to rolling your own.
- **Self-hosted (Docker/VPS)**: `pg_dump` on a schedule (cron) to
  encrypted, off-host storage; test restores periodically — an untested
  backup is not a backup.
- **Before any migration in production**: take a manual snapshot first.
  `drizzle-kit migrate` applies forward-only migrations; there is no
  automatic rollback, so schema rollback means either a hand-written
  down-migration or restoring from the pre-migration snapshot.
