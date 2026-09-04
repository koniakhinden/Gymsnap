// lib/image-prompt.ts
// Единственный источник правды по внешнему виду иллюстраций.
// Менять TEMPLATE_VERSION при любой правке блоков ниже — иначе в библиотеке
// окажутся картинки, сделанные по разным шаблонам, и это будет незаметно.

import { createHash } from "node:crypto";

export const TEMPLATE_VERSION = 2;

/** Токен из app/globals.css. Дублируется сюда намеренно: промпт — не CSS. */
const ACCENT = "#0D9488";

export const STYLE_BLOCK = `Victorian engraved plate illustration: fine ink hatching and
cross-hatching describing all volume and shadow, no flat fills, no
gradients, no photographic shading. Sepia-brown ink line, restrained
and precise, in the manner of a nineteenth-century anatomical plate.
Warm off-white background #FAFAF9, no paper texture, no border rule.
Equipment reduced to the minimum needed to identify it — the bar and
plates only, no rack, no machine frame, no weight stack tower. A single
straight horizontal floor line that both panels share. Face engraved
with restraint, no beard.`;

export const CAMERA_BLOCKS = {
  /** По умолчанию. Показывает углы в суставах и траекторию снаряда. */
  profile: `Strict profile view — the figure is seen from the side, facing the
right edge of the frame, shoulders perpendicular to the viewer, one arm
and one leg overlapping the other. Never a front view, never a
three-quarter view.`,

  /** Для отведений и разведений: в профиле движение не читается. */
  front: `Strict front view — the figure faces the viewer directly, shoulders
parallel to the image plane, both arms fully visible and symmetrical.
Never a side view, never a three-quarter view.`,

  /** Когда критична ширина хвата или постановки: в профиле дальняя рука скрыта. */
  three_quarter: `Three-quarter view — the figure is turned about 45 degrees toward the
viewer so that both hands and the full grip width are clearly visible.
Never a strict side view, never a flat front view.`,
} as const;

export type Camera = keyof typeof CAMERA_BLOCKS;

/** Whether the torso is vertical (squat, overhead press) or lying/planked
 *  (bench press, push-up, plank, crunch, inverted row). */
export type Orientation = "upright" | "horizontal";

/**
 * Canvas size per phase count and body orientation.
 *
 * A fixed 3:2 canvas wasted about a quarter of the frame on horizontal
 * movements: split into panels, each panel came out portrait while the figure
 * inside it is landscape. Wider canvases give a horizontal body a panel shaped
 * like the body.
 *
 * gpt-image-2 constraints, all satisfied below: both sides a multiple of 16,
 * aspect ratio at most 3:1, total pixels between 655,360 and 8,294,400.
 */
export const CANVAS_SIZES: Record<Orientation, Record<number, string>> = {
  upright: { 2: "1536x1024", 3: "2048x1024", 4: "2560x1024" },
  horizontal: { 2: "2048x1024", 3: "2560x1024", 4: "2560x896" },
};

export function canvasSize(phases: number, orientation: Orientation): string {
  return CANVAS_SIZES[orientation][phases] ?? CANVAS_SIZES[orientation][2];
}

/**
 * Пул внешности. Только тон кожи и волосы — без возраста и телосложения.
 * Категории ("a Black woman") модель глушит о собственный дефолт,
 * физическое описание — нет. Проверено на тестах.
 * Порядок менять нельзя: индекс детерминирован по хешу и завязан на позицию.
 */
export const FIGURE_POOL = [
  "a Black woman with short coily hair",
  "a Black man with a short afro",
  "a Black woman with box braids",
  "a Black man with short twists",
  "an East Asian man with straight black hair",
  "an East Asian woman with straight black hair tied in a bun",
  "a South Asian man with black wavy hair",
  "a South Asian woman with long dark hair tied back",
  "a Hispanic woman with dark wavy hair",
  "a Hispanic man with short dark curly hair",
  "a white woman with a blonde ponytail",
  "a white man with short brown hair",
] as const;

/** Одно упражнение — всегда один и тот же человек, при любом числе перегенераций. */
export function figureFor(exerciseId: string): string {
  const h = createHash("sha256").update(exerciseId).digest();
  return FIGURE_POOL[h.readUInt32BE(0) % FIGURE_POOL.length];
}

export function compositionBlock(phases: number, camera: Camera): string {
  const panelWord = phases === 2 ? "two panels" : `${phases} panels`;
  return `Composition: one single image, ${panelWord} side by side of equal width.
No borders, frames or boxes around the panels. Only one thin vertical
line separating them. The panels bleed to the edges of the image.

${CAMERA_BLOCKS[camera]}

Identical figure, identical camera angle and identical camera distance
in every panel. All panels share the same floor line at the same height.
Eye level.

A thin dashed arc in bright teal ${ACCENT} in the upper corner of the
frame, indicating the direction of the movement. It is a directional
marker only — it must not touch the equipment or the body, and it must
not attempt to trace the real path of the load.

No numerals, no words, no letters, no logos, no watermark.`;
}

export interface ImageSpec {
  exerciseName: string;
  phases: number;
  camera: Camera;
  panelDescriptions: string[];
  figure: string;
}

export function buildPrompt(spec: ImageSpec): string {
  const panels = spec.panelDescriptions
    .map((d, i) => `Panel ${i + 1}: ${d}`)
    .join("\n");

  return [
    STYLE_BLOCK,
    "",
    `Figure: ${spec.figure}. The same person appears in every panel.`,
    "",
    `Subject: ${spec.exerciseName}, shown in ${spec.phases} phases.`,
    panels,
    "",
    compositionBlock(spec.phases, spec.camera),
  ].join("\n");
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}
