// scripts/images.ts
// Запуск: npx tsx scripts/images.ts <команда> [флаги]
// Новых зависимостей нет: всё уже есть в проекте, OpenAI дёргается голым fetch.

import "./load-env";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { put, del } from "@vercel/blob";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { db } from "../lib/db";
import { exercises, exerciseImageSpecs, exerciseImages } from "../lib/db/schema";
import {
  buildPrompt,
  figureFor,
  promptHash,
  TEMPLATE_VERSION,
  type Camera,
} from "../lib/image-prompt";

// ─── настройки ──────────────────────────────────────────────────────────────

const OPENAI_MODEL = "gpt-image-2"; // пришпилено: алиас chatgpt-image-latest уедет посреди прогона
const OPENAI_QUALITY = "high";
const OPENAI_SIZE = "1536x1024";
const SPEC_MODEL = "claude-sonnet-5";
const CONCURRENCY = 4;

// ─── мелкие утилиты ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes(`--${name}`);

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let a = 1; a <= tries; a++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (a < tries) await new Promise((r) => setTimeout(r, 2000 * a));
    }
  }
  throw last;
}

// ─── шаг 1: спецификации через Claude ───────────────────────────────────────

const SpecSchema = z.object({
  phases: z
    .number()
    .int()
    .min(2)
    .max(4)
    .describe("Number of distinct positions worth drawing. Most lifts need 2."),
  camera: z
    .enum(["profile", "front", "three_quarter"])
    .describe(
      "profile by default; front for lateral raises, abductions and other movements " +
        "invisible from the side; three_quarter when grip or stance width is the point " +
        "of the exercise and the far hand would be hidden in profile.",
    ),
  panelDescriptions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "One entry per phase, in order. Each describes joint angles, spine position, " +
        "and where the load sits. Present tense, no sentence about style or camera.",
    ),
});

const SPEC_SYSTEM = `You convert exercise data into drawing instructions for an instructional
illustration. You never describe style, colour, background or camera framing — those are
fixed elsewhere. You describe only the body and the load.

Rules:
- Each panel must be an unambiguous position, not a movement. "Lowering the bar" is wrong;
  "bar touching the chest, elbows at 45 degrees" is right.
- State joint angles and depth explicitly where form matters (hip below knee, elbows tucked).
- Keep every panel comparable: same stance, same grip, only the moving parts differ.
- Mention the equipment concretely enough to draw it, including plate count where relevant.
- 2 phases for almost everything. Use 3-4 only for genuinely multi-position movements
  (burpee, clean, turkish get-up).`;

async function generateSpecs() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const only = flag("only")?.split(",");
  const limit = Number(flag("limit") ?? 50);

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      equipment: exercises.equipment,
      force: exercises.force,
      mechanic: exercises.mechanic,
      primaryMuscles: exercises.primaryMuscles,
      instructions: exercises.instructions,
    })
    .from(exercises)
    .leftJoin(exerciseImageSpecs, eq(exerciseImageSpecs.exerciseId, exercises.id))
    .where(
      only
        ? inArray(exercises.id, only)
        : has("force")
          ? sql`true`
          : isNull(exerciseImageSpecs.exerciseId),
    )
    .limit(limit);

  console.log(`spec: ${rows.length} упражнений`);

  await pool(rows, CONCURRENCY, async (ex) => {
    try {
      // Validation lives INSIDE withRetry: the model occasionally emits
      // panelDescriptions as a string instead of an array, or a panel count that
      // disagrees with `phases`. Those are transient bad draws, not permanent
      // failures — retrying gets a usable spec, whereas parsing outside the
      // retry dropped the exercise from the run for good.
      const spec = await withRetry(async () => {
        const res = await anthropic.messages.create({
          model: SPEC_MODEL,
          max_tokens: 1500,
          system: SPEC_SYSTEM,
          tools: [
            {
              name: "emit_spec",
              description: "Emit drawing instructions for this exercise.",
              input_schema: zodToJsonSchema(SpecSchema) as never,
            },
          ],
          tool_choice: { type: "tool", name: "emit_spec" },
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                name: ex.name,
                equipment: ex.equipment,
                force: ex.force,
                mechanic: ex.mechanic,
                primaryMuscles: ex.primaryMuscles,
                instructions: ex.instructions,
              }),
            },
          ],
        });

        const block = res.content.find((c) => c.type === "tool_use");
        if (!block || block.type !== "tool_use") throw new Error("no tool_use");
        const parsed = SpecSchema.parse(block.input);

        if (parsed.panelDescriptions.length !== parsed.phases) {
          throw new Error(
            `phases=${parsed.phases}, но панелей ${parsed.panelDescriptions.length}`,
          );
        }
        return parsed;
      });

      await db
        .insert(exerciseImageSpecs)
        .values({
          exerciseId: ex.id,
          phases: spec.phases,
          camera: spec.camera,
          panelDescriptions: spec.panelDescriptions,
          figure: figureFor(ex.id),
          templateVersion: TEMPLATE_VERSION,
        })
        .onConflictDoUpdate({
          target: exerciseImageSpecs.exerciseId,
          // руками правленную спеку не трогаем
          setWhere: eq(exerciseImageSpecs.editedByHand, false),
          set: {
            phases: spec.phases,
            camera: spec.camera,
            panelDescriptions: spec.panelDescriptions,
            templateVersion: TEMPLATE_VERSION,
            updatedAt: new Date(),
          },
        });

      console.log(`  ✓ ${ex.id} (${spec.phases} фазы, ${spec.camera})`);
    } catch (e) {
      console.error(`  ✗ ${ex.id}: ${(e as Error).message}`);
    }
  });
}

// ─── шаг 2: картинки через OpenAI → Blob → БД ───────────────────────────────

async function openaiImage(prompt: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt,
      size: OPENAI_SIZE,
      quality: OPENAI_QUALITY,
      n: 1,
    }),
  });

  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`нет b64_json: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function generateImages() {
  const only = flag("only")?.split(",");
  const limit = Number(flag("limit") ?? 20);
  const dry = has("dry");

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      phases: exerciseImageSpecs.phases,
      camera: exerciseImageSpecs.camera,
      panelDescriptions: exerciseImageSpecs.panelDescriptions,
      figure: exerciseImageSpecs.figure,
    })
    .from(exerciseImageSpecs)
    .innerJoin(exercises, eq(exercises.id, exerciseImageSpecs.exerciseId))
    .leftJoin(
      exerciseImages,
      and(
        eq(exerciseImages.exerciseId, exercises.id),
        eq(exerciseImages.status, "active"),
      ),
    )
    .where(only ? inArray(exercises.id, only) : isNull(exerciseImages.id))
    .limit(limit);

  console.log(`generate: ${rows.length} упражнений${dry ? " (dry run)" : ""}`);

  await pool(rows, CONCURRENCY, async (ex) => {
    try {
      const prompt = buildPrompt({
        exerciseName: ex.name,
        phases: ex.phases,
        camera: ex.camera as Camera,
        panelDescriptions: ex.panelDescriptions,
        figure: ex.figure,
      });

      if (dry) {
        console.log(`\n─── ${ex.id} ───\n${prompt}\n`);
        return;
      }

      const raw = await withRetry(() => openaiImage(prompt));
      const webp = await sharp(raw).webp({ quality: 90 }).toBuffer();
      const meta = await sharp(webp).metadata();

      const version = await nextVersion(ex.id);
      const pathname = `exercises/${ex.id}/v${version}.webp`;
      const blob = await put(pathname, webp, {
        access: "public",
        contentType: "image/webp",
      });

      await db.batch([
        db
          .update(exerciseImages)
          .set({ status: "archived" })
          .where(
            and(
              eq(exerciseImages.exerciseId, ex.id),
              eq(exerciseImages.status, "active"),
            ),
          ),

        db.insert(exerciseImages).values({
          id: nanoid(),
          exerciseId: ex.id,
          url: blob.url,
          blobPathname: pathname,
          status: "active",
          source: "generated",
          model: OPENAI_MODEL,
          prompt,
          promptHash: promptHash(prompt),
          width: meta.width,
          height: meta.height,
          bytes: webp.byteLength,
          version,
        }),
      ]);

      console.log(`  ✓ ${ex.id} v${version} (${Math.round(webp.byteLength / 1024)} KB)`);
    } catch (e) {
      console.error(`  ✗ ${ex.id}: ${(e as Error).message}`);
    }
  });
}

async function nextVersion(exerciseId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${exerciseImages.version}), 0)` })
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, exerciseId));
  return (row?.max ?? 0) + 1;
}

// ─── ревью и откат ──────────────────────────────────────────────────────────

/** Забраковать активную. Упражнение сразу возвращается к фото из free-exercise-db. */
async function reject() {
  const id = args[1];
  const note = flag("note") ?? "rejected in review";
  const r = await db
    .update(exerciseImages)
    .set({ status: "rejected", note })
    .where(
      and(eq(exerciseImages.exerciseId, id), eq(exerciseImages.status, "active")),
    );
  console.log(`${id}: активная помечена rejected`, r);
}

/** Вернуть предыдущую версию. --version N — конкретную. */
async function rollback() {
  const id = args[1];
  const want = flag("version");

  const versions = await db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, id))
    .orderBy(sql`${exerciseImages.version} desc`);

  const target = want
    ? versions.find((v) => v.version === Number(want))
    : versions.find((v) => v.status === "archived");

  if (!target) return console.error(`${id}: нечего откатывать`);

  await db.batch([
    db
      .update(exerciseImages)
      .set({ status: "archived" })
      .where(
        and(eq(exerciseImages.exerciseId, id), eq(exerciseImages.status, "active")),
      ),
    db
      .update(exerciseImages)
      .set({ status: "active" })
      .where(eq(exerciseImages.id, target.id)),
  ]);

  console.log(`${id}: активна v${target.version}`);
}

/** Полностью вернуть упражнение на free-exercise-db, ничего не удаляя. */
async function disable() {
  const id = args[1];
  await db
    .update(exerciseImages)
    .set({ status: "archived" })
    .where(
      and(eq(exerciseImages.exerciseId, id), eq(exerciseImages.status, "active")),
    );
  console.log(`${id}: вернулся на free-exercise-db`);
}

/** Удалить блобы забракованных версий. Строки в БД остаются как история. */
async function prune() {
  const rows = await db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.status, "rejected"));

  for (const r of rows) {
    try {
      await del(r.url);
      console.log(`  удалён ${r.blobPathname}`);
    } catch (e) {
      console.error(`  ✗ ${r.blobPathname}: ${(e as Error).message}`);
    }
  }
}

async function status() {
  const [s] = await db
    .select({
      total: sql<number>`count(*)`,
      withSpec: sql<number>`count(${exerciseImageSpecs.exerciseId})`,
    })
    .from(exercises)
    .leftJoin(exerciseImageSpecs, eq(exerciseImageSpecs.exerciseId, exercises.id));

  const byStatus = await db
    .select({ status: exerciseImages.status, n: sql<number>`count(*)` })
    .from(exerciseImages)
    .groupBy(exerciseImages.status);

  console.log(`упражнений: ${s.total}, со спекой: ${s.withSpec}`);
  for (const b of byStatus) console.log(`  ${b.status}: ${b.n}`);
}

// ─── роутер ─────────────────────────────────────────────────────────────────

const commands: Record<string, () => Promise<void>> = {
  specs: generateSpecs,
  generate: generateImages,
  reject,
  rollback,
  disable,
  prune,
  status,
};

const run = commands[command ?? ""];
if (!run) {
  console.log(`команды: ${Object.keys(commands).join(" | ")}`);
  process.exit(1);
}
run().then(() => process.exit(0));
