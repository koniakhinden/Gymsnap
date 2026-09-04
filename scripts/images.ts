// scripts/images.ts
// Запуск: npx tsx scripts/images.ts <команда> [флаги]
// Новых зависимостей нет: всё уже есть в проекте, OpenAI дёргается голым fetch.

import "./load-env";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { del } from "@vercel/blob";

import { db } from "../lib/db";
import { exercises, exerciseImageSpecs, exerciseImages } from "../lib/db/schema";
import { TEMPLATE_VERSION } from "../lib/image-prompt";
import { loadUsageRanking } from "../lib/image-admin";
import { generateSpec, SPEC_COLUMNS } from "../lib/image-spec";
import {
  approveImage,
  DEFAULT_QUALITY,
  generateImage,
  promptForSpec,
  QUALITIES,
  sizeForSpec,
  type Quality,
} from "../lib/image-generation";

// ─── настройки ──────────────────────────────────────────────────────────────

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

/**
 * Ids упражнений, которые чаще всего реально попадают к пользователям, из числа
 * тех, что ещё ждут этого шага. Нужно, чтобы бюджет уходил на ядро библиотеки,
 * а не на её длинный хвост: несколько сотен движений несут почти все планы.
 */
async function topPending(needs: (id: string) => boolean, limit: number): Promise<string[]> {
  const ranking = await loadUsageRanking();
  return ranking
    .filter((r) => needs(r.id))
    .slice(0, limit)
    .map((r) => r.id);
}

/** Рейтинг выдачи. Ничего не тратит — только показывает, что пойдёт в работу. */
async function top() {
  const limit = Number(flag("limit") ?? 40);
  const ranking = await loadUsageRanking();
  const specced = new Set(
    (await db.select({ id: exerciseImageSpecs.exerciseId }).from(exerciseImageSpecs)).map(
      (r) => r.id,
    ),
  );
  const withImage = new Set(
    (
      await db
        .select({ id: exerciseImages.exerciseId })
        .from(exerciseImages)
        .where(inArray(exerciseImages.status, ["active", "pending"]))
    ).map((r) => r.id),
  );

  console.log(`упражнений реально выдавалось: ${ranking.length}`);
  console.log("№   выдач (осн/альт/разм/quick)  спека  картинка  упражнение");
  ranking.slice(0, limit).forEach((r, i) => {
    const mark = (b: boolean) => (b ? "  ✓  " : "  —  ");
    console.log(
      `${String(i + 1).padStart(3)}  ${String(r.total).padStart(4)} ` +
        `(${r.prescribed}/${r.alternates}/${r.routine}/${r.quick})` +
        `${mark(specced.has(r.id))}${mark(withImage.has(r.id))}  ${r.name}  [${r.id}]`,
    );
  });

  const needSpec = ranking.filter((r) => !specced.has(r.id)).length;
  console.log(`\nиз выдававшихся без спеки: ${needSpec}`);
}

// ─── шаг 1: спецификации через Claude ───────────────────────────────────────

async function generateSpecs() {
  let only = flag("only")?.split(",");
  const limit = Number(flag("limit") ?? 50);

  // --top: взять самые выдаваемые из тех, у кого спеки ещё нет.
  if (has("top") && !only) {
    const specced = new Set(
      (await db.select({ id: exerciseImageSpecs.exerciseId }).from(exerciseImageSpecs)).map(
        (r) => r.id,
      ),
    );
    only = await topPending((id) => !specced.has(id), limit);
    if (only.length === 0) return console.log("spec: у всех выдававшихся спека уже есть");
    console.log(`spec: топ-${only.length} по выдаче`);
  }

  const rows = await db
    .select(SPEC_COLUMNS)
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
      const spec = await generateSpec(ex);
      console.log(`  ✓ ${ex.id} (${spec.phases} фазы, ${spec.camera}, ${spec.orientation})`);
    } catch (e) {
      console.error(`  ✗ ${ex.id}: ${(e as Error).message}`);
    }
  });
}

// ─── шаг 2: картинки через OpenAI → Blob → БД ───────────────────────────────

async function generateImages() {
  let only = flag("only")?.split(",");
  const limit = Number(flag("limit") ?? 20);
  const dry = has("dry");

  // --top: рисовать в порядке реальной выдачи, пропуская уже нарисованное.
  if (has("top") && !only) {
    const drawn = new Set(
      (
        await db
          .select({ id: exerciseImages.exerciseId })
          .from(exerciseImages)
          .where(inArray(exerciseImages.status, ["active", "pending"]))
      ).map((r) => r.id),
    );
    const specced = new Set(
      (await db.select({ id: exerciseImageSpecs.exerciseId }).from(exerciseImageSpecs)).map(
        (r) => r.id,
      ),
    );
    only = await topPending((id) => specced.has(id) && !drawn.has(id), limit);
    if (only.length === 0) return console.log("generate: нечего рисовать из выдававшихся");
    console.log(`generate: топ-${only.length} по выдаче`);
  }
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
  top,
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
