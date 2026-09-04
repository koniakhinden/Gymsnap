// Shared image-generation core: the OpenAI call, the Blob upload and the
// exercise_images bookkeeping.
//
// Both the CLI (scripts/images.ts) and the local workbench (/admin/images) go
// through this module. Keeping one implementation is deliberate — a second copy
// would drift from this one and the difference would only surface months later,
// as a batch of images that don't match the rest of the library.

import { and, desc, eq, sql } from "drizzle-orm";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import sharp from "sharp";

import { db } from "./db";
import { exerciseImageSpecs, exerciseImages } from "./db/schema";
import { buildPrompt, canvasSize, promptHash, type Camera, type Orientation } from "./image-prompt";

export const OPENAI_MODEL = "gpt-image-2"; // пришпилено: алиас chatgpt-image-latest уедет посреди прогона
// На quality "high" один кадр рисуется минутами, а у fetch по умолчанию таймаута
// нет вообще — зависший запрос держал бы слот в пуле до конца прогона.
export const OPENAI_TIMEOUT_MS = 600_000;

export type Quality = "low" | "medium" | "high";
export const QUALITIES: Quality[] = ["low", "medium", "high"];
export const DEFAULT_QUALITY: Quality = "high";

/**
 * ЗАГЛУШКИ. Подставь реальные цифры с прайса OpenAI для gpt-image-2.
 * Используются только для оценки расходов на экране — это не биллинг.
 */
export const IMAGE_COST_USD: Record<Quality, number> = {
  low: 0.02,
  medium: 0.07,
  high: 0.19,
};

/** Ошибка, которую бессмысленно повторять: параметры запроса неверны. */
export class PermanentError extends Error {}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let a = 1; a <= tries; a++) {
    try {
      return await fn();
    } catch (e) {
      // 400 и прочие 4xx (кроме 429) означают кривой запрос — повтор даст тот же
      // ответ и лишь утроит время падения.
      if (e instanceof PermanentError) throw e;
      last = e;
      if (a < tries) await new Promise((r) => setTimeout(r, 2000 * a));
    }
  }
  throw last;
}

export async function openaiImage(
  prompt: string,
  size: string,
  quality: Quality
): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENAI_MODEL, prompt, size, quality, n: 1 }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = `openai ${res.status}: ${await res.text()}`;
    // 429 и 5xx — временные, их повторяем. Остальные 4xx (в первую очередь 400:
    // недопустимый размер, отклонённый промпт, нет доступа к модели) — нет.
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new PermanentError(msg);
    }
    throw new Error(msg);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`нет b64_json: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

export type SpecForPrompt = {
  phases: number;
  camera: string;
  orientation: string;
  panelDescriptions: string[];
  figure: string;
};

/** The exact text that will be sent to the API, assembled from a stored spec. */
export function promptForSpec(exerciseName: string, spec: SpecForPrompt): string {
  return buildPrompt({
    exerciseName,
    phases: spec.phases,
    camera: spec.camera as Camera,
    panelDescriptions: spec.panelDescriptions,
    figure: spec.figure,
  });
}

/** Canvas size implied by a stored spec. Changes when phases/orientation change. */
export function sizeForSpec(spec: Pick<SpecForPrompt, "phases" | "orientation">): string {
  return canvasSize(spec.phases, spec.orientation as Orientation);
}

async function nextVersion(exerciseId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${exerciseImages.version}), 0)` })
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, exerciseId));
  return (row?.max ?? 0) + 1;
}

export type GeneratedRow = {
  id: string;
  version: number;
  url: string;
  bytes: number;
  size: string;
  quality: Quality;
};

/**
 * Render one exercise and store the result as `pending`.
 *
 * The currently active image is left alone: a new render is a candidate, not a
 * replacement, until someone approves it. That is what makes the workbench safe
 * to run against the live database.
 *
 * `prompt` can be overridden to render a hand-edited prompt without first
 * persisting it to the spec.
 */
export async function generateImage(opts: {
  exerciseId: string;
  exerciseName: string;
  spec: SpecForPrompt;
  quality?: Quality;
  prompt?: string;
}): Promise<GeneratedRow> {
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const prompt = opts.prompt ?? promptForSpec(opts.exerciseName, opts.spec);
  const size = sizeForSpec(opts.spec);

  const raw = await withRetry(() => openaiImage(prompt, size, quality));
  const webp = await sharp(raw).webp({ quality: 90 }).toBuffer();
  const meta = await sharp(webp).metadata();

  const version = await nextVersion(opts.exerciseId);
  const pathname = `exercises/${opts.exerciseId}/v${version}.webp`;
  const blob = await put(pathname, webp, {
    access: "public",
    contentType: "image/webp",
  });

  const id = nanoid();
  await db.insert(exerciseImages).values({
    id,
    exerciseId: opts.exerciseId,
    url: blob.url,
    blobPathname: pathname,
    status: "pending",
    source: "generated",
    model: OPENAI_MODEL,
    quality,
    prompt,
    promptHash: promptHash(prompt),
    width: meta.width,
    height: meta.height,
    bytes: webp.byteLength,
    version,
  });

  return { id, version, url: blob.url, bytes: webp.byteLength, size, quality };
}

/** Promote a pending (or archived) row to active, retiring the current active. */
export async function approveImage(imageId: string): Promise<void> {
  const [target] = await db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.id, imageId))
    .limit(1);
  if (!target) throw new Error(`нет картинки ${imageId}`);

  // neon-http has no interactive transactions; batch is the atomic equivalent.
  // Order matters: the partial unique index rejects a second active row, so the
  // incumbent must be archived in the same statement list, before the promotion.
  await db.batch([
    db
      .update(exerciseImages)
      .set({ status: "archived" })
      .where(
        and(
          eq(exerciseImages.exerciseId, target.exerciseId),
          eq(exerciseImages.status, "active")
        )
      ),
    db.update(exerciseImages).set({ status: "active" }).where(eq(exerciseImages.id, imageId)),
  ]);
}

/** Mark a render bad. The exercise falls back to its free-exercise-db photos. */
export async function rejectImage(imageId: string, note: string): Promise<void> {
  await db
    .update(exerciseImages)
    .set({ status: "rejected", note })
    .where(eq(exerciseImages.id, imageId));
}

export async function listVersions(exerciseId: string) {
  return db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, exerciseId))
    .orderBy(desc(exerciseImages.version));
}

export async function getSpec(exerciseId: string) {
  const [row] = await db
    .select()
    .from(exerciseImageSpecs)
    .where(eq(exerciseImageSpecs.exerciseId, exerciseId))
    .limit(1);
  return row ?? null;
}
