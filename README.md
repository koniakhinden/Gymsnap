# GymSnap

A local prototype: an AI trainer that turns a photo of your gym into a weekly workout plan.
Single-user, no auth, runs entirely on your machine.

## Stack

- Next.js 15 (App Router, TypeScript) + Tailwind CSS
- SQLite via Drizzle ORM (`./data/gymsnap.db`)
- Anthropic SDK (`@anthropic-ai/sdk`), model `claude-sonnet-5`
- Exercise library: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (~870 exercises, public domain)

## Setup

```bash
npm install
```

Create `.env.local` in the project root:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and set your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Seed the database (creates `./data/gymsnap.db`, downloads and loads the exercise library into it):

```bash
npm run seed
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — best viewed on a phone-sized viewport (it's mobile-first; use your browser's device toolbar or an actual phone on the same network via the "Network" URL printed in the terminal).

## Database migrations

The schema lives in `lib/db/schema.ts`. Migration SQL is generated into `./drizzle`. If you change the schema:

```bash
npm run db:generate   # writes a new migration file to ./drizzle
npm run db:migrate    # applies pending migrations to ./data/gymsnap.db
```

`npm run seed` re-downloads/re-loads `data/exercises.json` if it isn't already present, and always re-populates the `exercises` table.

## App flow

1. **Setup** (`/setup`) — drag/drop or pick 1–10 photos of your gym (JPEG/PNG/HEIC, ≤10 MB each). "Recognize equipment" sends them to Claude vision, which returns a de-duplicated equipment list (accounting for mirrors), with a confidence rating per item.
2. **Confirm** (`/setup/confirm`) — review, edit, delete, or manually add equipment. Low-confidence items are flagged "Please verify". Saving writes the gym + equipment to the database.
3. **Profile** (`/profile`) — age group, body weight/unit, sex, experience, goal, days/week, session length, injuries/limitations, cardio preference.
4. **Plan** (`/plan`) — "Generate week N" calls Claude with your profile, confirmed equipment, and full training history (including past check-ins) and gets back a structured week plan. Exercises are validated against the exercise library and your available equipment; anything Claude can't match after one retry is marked "Unverified" rather than silently trusting it. Each exercise links to technique photos (lightbox on tap). Use "Print / Save as PDF" for a print-friendly layout.
5. **Check-in** (`/checkin`) — mark each day completed/partial/skipped, add a comment, rate wellbeing/knees/lower back, then generate the next week — the new plan takes this feedback into account (progression is capped at 5–10%/week and backs off if you reported pain or skipped days).
6. **Dashboard** (`/`) — setup/profile status, current week, and links to past weeks.

## Notes on the exercise library / equipment matching

Claude never invents exercises: the plan-generation prompt is given a compact list of valid exercise IDs, pre-filtered to only those compatible with your confirmed equipment (e.g. machine-only exercises are excluded if you have no strength machines). If Claude's response references an exercise ID outside that list, the API route retries once with an explicit correction; if it's still invalid, that entry is kept but flagged `unverified` instead of failing the whole request.

## PWA

`public/manifest.json` + icons in `public/icons/` make the app installable ("Add to Home Screen") in standalone mode on a phone.

## What's intentionally not here

No authentication, payments, deployment config, dark theme, or i18n — this is a local single-user prototype.
