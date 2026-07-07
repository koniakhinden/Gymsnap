import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const EXERCISES_PATH = path.join(process.cwd(), "data", "exercises.json");

type RawExercise = {
  id: string;
  name: string;
  equipment: string | null;
  category: string | null;
  level: string | null;
  force: string | null;
  mechanic: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

async function ensureExercisesFile() {
  if (fs.existsSync(EXERCISES_PATH)) {
    console.log("Using cached data/exercises.json");
    return;
  }
  console.log("Downloading exercise library from free-exercise-db...");
  const res = await fetch(EXERCISES_URL);
  if (!res.ok) {
    throw new Error(`Failed to download exercises.json: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(EXERCISES_PATH), { recursive: true });
  fs.writeFileSync(EXERCISES_PATH, text);
  console.log("Saved to", EXERCISES_PATH);
}

async function seed() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local not present — assume env vars are already exported
  }

  // Dynamic imports so DATABASE_URL is loaded before lib/db reads it.
  const { db } = await import("../lib/db");
  const { exercises } = await import("../lib/db/schema");

  await ensureExercisesFile();
  const raw = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf-8")) as RawExercise[];
  console.log(`Loaded ${raw.length} exercises. Upserting into Postgres...`);

  const rows = raw.map((r) => ({
    id: r.id,
    name: r.name,
    equipment: r.equipment ?? null,
    category: r.category ?? null,
    level: r.level ?? null,
    force: r.force ?? null,
    mechanic: r.mechanic ?? null,
    primaryMuscles: r.primaryMuscles ?? [],
    secondaryMuscles: r.secondaryMuscles ?? [],
    instructions: r.instructions ?? [],
    images: r.images ?? [],
  }));

  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(exercises)
      .values(batch)
      .onConflictDoUpdate({
        target: exercises.id,
        set: {
          name: sql`excluded.name`,
          equipment: sql`excluded.equipment`,
          category: sql`excluded.category`,
          level: sql`excluded.level`,
          force: sql`excluded.force`,
          mechanic: sql`excluded.mechanic`,
          primaryMuscles: sql`excluded.primary_muscles`,
          secondaryMuscles: sql`excluded.secondary_muscles`,
          instructions: sql`excluded.instructions`,
          images: sql`excluded.images`,
        },
      });
    console.log(`  upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(`Seeded ${raw.length} exercises into the database.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
