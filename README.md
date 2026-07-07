# GymSnap

An AI trainer that turns a photo of your gym into a weekly workout plan.
Single-user, no auth — but built on a serverless-compatible stack so it can run on Vercel.

## Stack

- Next.js 15 (App Router, TypeScript) + Tailwind CSS
- Postgres via [Neon](https://neon.tech) + Drizzle ORM (`@neondatabase/serverless`, `drizzle-orm/neon-http`)
- Photo storage via [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (`@vercel/blob`)
- Anthropic SDK (`@anthropic-ai/sdk`), model `claude-sonnet-5`
- Exercise library: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (~870 exercises, public domain)

## Required environment variables

Create `.env.local` in the project root (copy `.env.local.example`) and set:

| Variable | Where to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `DATABASE_URL` | A Neon project connection string (Neon dashboard → Connection Details). Use the pooled/`-pooler` host if offered. |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → your Blob store → `.env.local` tab. Locally you need this explicitly; on Vercel it's injected automatically once the Blob store is linked to the project. |

There's no separate local-dev database — local development talks to the same Neon Postgres instance as production. Neon's free tier is fine for this; just don't point it at data you care about while iterating.

## First run

```bash
npm install
npm run db:migrate   # applies the schema in ./drizzle to your Neon database
npm run seed          # downloads/caches data/exercises.json and upserts ~870 exercises
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — best viewed on a phone-sized viewport (it's mobile-first; use your browser's device toolbar or an actual phone on the same network via the "Network" URL printed in the terminal).

## Deploying to Vercel

Set `ANTHROPIC_API_KEY` and `DATABASE_URL` as project environment variables. Add a Vercel Blob store to the project (Storage tab) — this automatically sets `BLOB_READ_WRITE_TOKEN` for you. Run `npm run db:migrate` and `npm run seed` once against the same `DATABASE_URL` (locally, or via `vercel env pull` + running the scripts) before first use — there's no build-time migration step.

## Database migrations

The schema lives in `lib/db/schema.ts` (Postgres types via `drizzle-orm/pg-core`). Migration SQL is generated into `./drizzle`. If you change the schema:

```bash
npm run db:generate   # writes a new migration file to ./drizzle (schema diff only, no DB connection needed)
npm run db:migrate    # applies pending migrations to the Neon database in DATABASE_URL
```

`npm run seed` re-downloads/re-loads `data/exercises.json` if it isn't already cached locally, then upserts every exercise by `id` (`ON CONFLICT DO UPDATE`) — safe to re-run any time, including against a database that already has data.

## App flow

1. **Setup** (`/setup`) — drag/drop or pick 1–10 photos of your gym (JPEG/PNG/HEIC, ≤10 MB each). "Recognize equipment" compresses each photo (sharp: resized to fit 1568px, JPEG q80), sends the compressed version to Claude vision, and uploads that same compressed copy to Vercel Blob (`access: "public"`) — the original, uncompressed file never leaves the browser/server memory. Claude returns a de-duplicated equipment list (accounting for mirrors), with a confidence rating per item.
2. **Confirm** (`/setup/confirm`) — review, edit, delete, or manually add equipment. Low-confidence items are flagged "Please verify". Saving writes the gym + equipment + Blob photo URLs to the database.
3. **Profile** (`/profile`) — age group, body weight/unit, sex, experience, goal, days/week, session length, injuries/limitations, cardio preference.
4. **Plan** (`/plan`) — "Generate week N" calls Claude with your profile, confirmed equipment, and full training history (including past check-ins) and gets back a structured week plan. Exercises are validated against the exercise library and your available equipment; anything Claude can't match after one retry is marked "Unverified" rather than silently trusting it. Each exercise links to technique photos (lightbox on tap). Use "Print / Save as PDF" for a print-friendly layout.
5. **Check-in** (`/checkin`) — mark each day completed/partial/skipped, add a comment, rate wellbeing/knees/lower back, then generate the next week — the new plan takes this feedback into account (progression is capped at 5–10%/week and backs off if you reported pain or skipped days).
6. **Dashboard** (`/`) — setup/profile status, current week, and links to past weeks.

## Notes on the exercise library / equipment matching

Claude never invents exercises: the plan-generation prompt is given a compact list of valid exercise IDs, pre-filtered to only those compatible with your confirmed equipment (e.g. machine-only exercises are excluded if you have no strength machines). If Claude's response references an exercise ID outside that list, the API route retries once with an explicit correction; if it's still invalid, that entry is kept but flagged `unverified` instead of failing the whole request.

## PWA

`public/manifest.json` + icons in `public/icons/` make the app installable ("Add to Home Screen") in standalone mode on a phone.

## What's intentionally not here

No authentication, payments, dark theme, or i18n — this is a single-user prototype.
