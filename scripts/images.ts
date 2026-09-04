// scripts/images.ts
// Запуск: npx tsx scripts/images.ts <команда> [флаги]
// Новых зависимостей нет: всё уже есть в проекте, OpenAI дёргается голым fetch.

import "./load-env";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { del } from "@vercel/blob";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { db } from "../lib/db";
import { exercises, exerciseImageSpecs, exerciseImages } from "../lib/db/schema";
import { figureFor, TEMPLATE_VERSION } from "../lib/image-prompt";
import {
  approveImage,
  DEFAULT_QUALITY,
  generateImage,
  promptForSpec,
  QUALITIES,
  sizeForSpec,
  withRetry,
  type Quality,
} from "../lib/image-generation";

// ─── настройки ──────────────────────────────────────────────────────────────

const SPEC_MODEL = "claude-sonnet-5";
// Если ловишь 429 — снижай параллелизм, а не увеличивай паузу между ретраями.
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
  orientation: z
    .enum(["upright", "horizontal"])
    .describe(
      "upright when the torso is vertical (squats, standing presses, seated rows); " +
        "horizontal when the body lies down or holds a horizontal plank (bench press, " +
        "inverted row, push-up, plank, crunch). Picks the canvas aspect ratio.",
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
  (burpee, clean, turkish get-up).
- Orientation describes the TORSO, not the limbs: "upright" for squats, standing presses,
  seated rows and anything performed on the feet or seated upright; "horizontal" for bench
  press, push-ups, planks, crunches, inverted rows and anything lying or held in a
  horizontal plank.`;

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
          orientation: spec.orientation,
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
            orientation: spec.orientation,
            panelDescriptions: spec.panelDescriptions,
            templateVersion: TEMPLATE_VERSION,
            updatedAt: new Date(),
          },
        });

      console.log(`  ✓ ${ex.id} (${spec.phases} фазы, ${spec.camera}, ${spec.orientation})`);
    } catch (e) {
      console.error(`  ✗ ${ex.id}: ${(e as Error).message}`);
    }
  });
}

// ─── шаг 2: картинки через OpenAI → Blob → БД ───────────────────────────────

async function generateImages() {
  const only = flag("only")?.split(",");
  const limit = Number(flag("limit") ?? 20);
  const dry = has("dry");
  const quality = (flag("quality") ?? DEFAULT_QUALITY) as Quality;
  if (!QUALITIES.includes(quality)) {
    console.error(`неизвестный --quality ${quality}; допустимо: ${QUALITIES.join(", ")}`);
    process.exit(1);
  }

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      phases: exerciseImageSpecs.phases,
      camera: exerciseImageSpecs.camera,
      orientation: exerciseImageSpecs.orientation,
      panelDescriptions: exerciseImageSpecs.panelDescriptions,
      figure: exerciseImageSpecs.figure,
    })
    .from(exerciseImageSpecs)
    .innerJoin(exercises, eq(exercises.id, exerciseImageSpecs.exerciseId))
    // Skip anything that already has a render worth looking at — active OR still
    // awaiting review. Without the pending arm, a re-run would redraw (and
    // re-bill) every image that is merely sitting in the review queue.
    .leftJoin(
      exerciseImages,
      and(
        eq(exerciseImages.exerciseId, exercises.id),
        inArray(exerciseImages.status, ["active", "pending"]),
      ),
    )
    .where(only ? inArray(exercises.id, only) : isNull(exerciseImages.id))
    .limit(limit);

  console.log(`generate: ${rows.length} упражнений${dry ? " (dry run)" : ""}`);

  await pool(rows, CONCURRENCY, async (ex) => {
    try {
      const spec = {
        phases: ex.phases,
        camera: ex.camera,
        orientation: ex.orientation,
        panelDescriptions: ex.panelDescriptions,
        figure: ex.figure,
      };
      const prompt = promptForSpec(ex.name, spec);

      const size = sizeForSpec(spec);

      if (dry) {
        console.log(`\n─── ${ex.id} (${ex.orientation}, ${size}) ───\n${prompt}\n`);
        return;
      }

      const row = await generateImage({
        exerciseId: ex.id,
        exerciseName: ex.name,
        spec,
        quality,
        prompt,
      });

      console.log(
        `  ✓ ${ex.id} v${row.version} ${size} ${quality} (${Math.round(row.bytes / 1024)} KB) — pending`,
      );
    } catch (e) {
      console.error(`  ✗ ${ex.id}: ${(e as Error).message}`);
    }
  });
}

// ─── ревью и откат ──────────────────────────────────────────────────────────

/** Принять ожидающую картинку: она становится активной, прежняя уходит в архив. */
async function approve() {
  const id = args[1];
  const [row] = await db
    .select()
    .from(exerciseImages)
    .where(and(eq(exerciseImages.exerciseId, id), eq(exerciseImages.status, "pending")))
    .orderBy(sql`${exerciseImages.version} desc`)
    .limit(1);
  if (!row) return console.error(`${id}: нечего принимать (нет pending)`);
  await approveImage(row.id);
  console.log(`${id}: активна v${row.version}`);
}

/** Забраковать. Упражнение сразу возвращается к фото из free-exercise-db. */
async function reject() {
  const id = args[1];
  const note = flag("note") ?? "rejected in review";
  const r = await db
    .update(exerciseImages)
    .set({ status: "rejected", note })
    .where(
      and(
        eq(exerciseImages.exerciseId, id),
        inArray(exerciseImages.status, ["pending", "active"]),
      ),
    );
  console.log(`${id}: помечена rejected`, r);
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

  // Разбивка по версии шаблона — главный признак того, что библиотека поехала:
  // спеки, собранные под разные TEMPLATE_VERSION, дадут картинки в разных стилях,
  // и по самим картинкам это уже не отличить.
  const byTemplate = await db
    .select({
      version: exerciseImageSpecs.templateVersion,
      orientation: exerciseImageSpecs.orientation,
      edited: sql<number>`count(*) filter (where ${exerciseImageSpecs.editedByHand})`,
      n: sql<number>`count(*)`,
    })
    .from(exerciseImageSpecs)
    .groupBy(exerciseImageSpecs.templateVersion, exerciseImageSpecs.orientation)
    .orderBy(exerciseImageSpecs.templateVersion, exerciseImageSpecs.orientation);

  const byStatus = await db
    .select({ status: exerciseImages.status, n: sql<number>`count(*)` })
    .from(exerciseImages)
    .groupBy(exerciseImages.status);

  console.log(`упражнений: ${s.total}, со спекой: ${s.withSpec}`);

  console.log("спеки:");
  for (const t of byTemplate) {
    const edited = t.edited > 0 ? `, правлено руками ${t.edited}` : "";
    console.log(`  шаблон v${t.version} / ${t.orientation}: ${t.n}${edited}`);
  }
  const stale = byTemplate.filter((t) => t.version !== TEMPLATE_VERSION);
  if (stale.length > 0) {
    const n = stale.reduce((a, t) => a + Number(t.n), 0);
    console.log(
      `  ⚠ ${n} спек на старом шаблоне (сейчас v${TEMPLATE_VERSION}) — пересчитай их: specs --only <id,...>`,
    );
  }

  console.log("картинки:");
  if (byStatus.length === 0) console.log("  пока ничего не сгенерировано");
  for (const b of byStatus) console.log(`  ${b.status}: ${b.n}`);
}

// ─── роутер ─────────────────────────────────────────────────────────────────

const commands: Record<string, () => Promise<void>> = {
  specs: generateSpecs,
  generate: generateImages,
  approve,
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
