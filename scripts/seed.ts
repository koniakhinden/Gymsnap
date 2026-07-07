import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { exercises } from "../lib/db/schema";

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
  await ensureExercisesFile();
  const raw = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf-8")) as RawExercise[];
  console.log(`Loaded ${raw.length} exercises. Seeding database...`);

  db.delete(exercises).run();

  db.transaction((tx) => {
    for (const r of raw) {
      tx.insert(exercises)
        .values({
          id: r.id,
          name: r.name,
          equipment: r.equipment ?? null,
          category: r.category ?? null,
          level: r.level ?? null,
          force: r.force ?? null,
          mechanic: r.mechanic ?? null,
          primaryMuscles: JSON.stringify(r.primaryMuscles ?? []),
          secondaryMuscles: JSON.stringify(r.secondaryMuscles ?? []),
          instructions: JSON.stringify(r.instructions ?? []),
          images: JSON.stringify(r.images ?? []),
        })
        .run();
    }
  });

  console.log(`Seeded ${raw.length} exercises into the database.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
