# Azhar Thanaweya Tracker

Study-progress website for Al-Azhar secondary students (Egypt). Available grades: **3rd secondary science (`s3sci`) and literary (`s3lit`), year 2026/2027**. Built to add 1st/2nd secondary later without schema or code changes.

The full product plan (Arabic) is in `خطة-الموقع.md` — read it before any design decision.

## Stack
- Frontend: Vite + React + TypeScript, Arabic-only UI, `dir="rtl"`, mobile-first, light/dark.
- Repo: `ShadyYasser/azhar-thanaweya-tracker` (public), default branch `main`.
- Hosting: GitHub Pages at `https://shadyyasser.github.io/azhar-thanaweya-tracker/`, deployed by GitHub Actions on push to `main` (Vite `base` must be `/azhar-thanaweya-tracker/`). Use hash routing or a 404.html fallback so deep links work on Pages.
- Backend: Supabase (Auth + Postgres + RLS). Project `azhar-thanaweya-tracker`, ref `sygalitwbokkthracwmn`, URL `https://sygalitwbokkthracwmn.supabase.co`.
- Client config comes from env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public values, see `.env.example`). Never commit or use the service_role / secret key or the DB password in the frontend.

## Content (source of truth = JSON in the repo)
- `content/index.json` — catalog of grades (`s1bac`, `s2sci`, `s2lit`, `s3sci`, `s3lit`) with `status` `available` | `planned`. Only `available` grades are selectable.
- `content/grades/<gradeCode>/curriculum.json` — groups, madhhabs, subjects → units → lessons. `content/grades/s3sci/المنهج-الكامل.md` is the human-readable copy.
- Subject fields: `id`, `name`, `group`, `book`, `periods`, `units`, optional `madhhab` (show only to students of that madhhab), `optional` + `optionalKey` (`french` | `qiraat`; shown only when the profile flag `show_<key>` is on, and the setup/settings option appears only if the selected grade has a subject with that key; a new key needs a profile column, the `OPTIONAL_SUBJECTS` list in `src/lib/content.ts` and `OPTIONAL_KEYS` in `scripts/check-content.mjs`), `note`, `needsVerification`.
- Group ids so far: `quran`, `sharia`, `arabic`, `science` (s3sci), `cultural` (s3lit: history, geography, statistics), `languages`. The UI renders whatever groups the curriculum lists, in order.
- Lesson fields: `id`, `title`, `month`, `term`, `monthName`, optional `note`, `memorize`, `kind` (`quran` | `exercise` | `review` | `text`), and for Quran `surah`, `fromAyah`, `toAyah`.
- Future quizzes: `content/grades/<gradeCode>/quizzes/<lessonId>.json` (format in the plan, section 5). The UI shows a quiz button only when that file exists.

### Rules that protect user progress — never break these
1. Progress rows reference **lesson IDs** (`s3sci-nahw-003`). Never rename, renumber or delete an existing ID.
2. New lesson → new ID (next number in that subject), wherever it sits in the list.
3. Lesson removed from the syllabus → `"archived": true`, never delete it.
4. Split/merge → `migrations.json` next to the curriculum maps old ID → array of new IDs (the old lessons stay, `archived`). On load the site calls the `apply_lesson_migrations(mappings)` RPC (security invoker, RLS-scoped, idempotent) when an old lesson has progress and a new one has none: it copies status/memorized/dates/revision_count to new IDs without a row, never overwrites, never deletes. Archived lessons are hidden and excluded from completion.
5. Bump `contentVersion` on every content change.
6. Add a CI check that fails on duplicate IDs or on IDs that existed on `main` and disappeared.

## Database (Supabase) — see plan section 4
Tables: `profiles` (role `student`|`admin`, email (trigger-synced), madhhab, show_french, show_qiraat, active_grade), `enrollments`, `lesson_progress` (PK user_id+lesson_id), `study_log`, `quiz_attempts`.
- RLS on every table: users read/write only their own rows; admins can read all.
- Users must not be able to change their own `role` (enforce in policy or trigger).
- Create the `profiles` row automatically on signup (trigger on `auth.users`).
- Clients may update only `display_name`, `madhhab`, `show_french`, `show_qiraat`, `active_grade`, `role` (column grants; `role` is further guarded by a trigger and the last admin cannot be demoted).
- RPCs: `apply_lesson_migrations` (security invoker) and `admin_delete_user` (security definer by design; admins only, never self or another admin).
- Nothing in the schema is grade-specific; adding a grade needs no migration.
- Keep every schema change as a SQL file in `supabase/migrations/` (timestamped) so it can be re-applied.

## Conventions
- UI text in Egyptian-friendly Modern Standard Arabic; code, identifiers and commits in English.
- Keep it simple: no heavy UI framework is required; a small component set is fine.
- Do not commit `.env`.
