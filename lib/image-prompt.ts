// lib/image-prompt.ts
// Единственный источник правды по внешнему виду иллюстраций.
// Менять TEMPLATE_VERSION при любой правке блоков ниже — иначе в библиотеке
// окажутся картинки, сделанные по разным шаблонам, и это будет незаметно.

import { createHash } from "node:crypto";

export const TEMPLATE_VERSION = 1;

/** Токены из app/globals.css. Дублируются сюда намеренно: промпт — не CSS. */
const INK = "#1C1917";
const ACCENT = "#0D9488";

export const STYLE_BLOCK = `Instructional fitness illustration, flat vector style, thick clean
outlines in near-black ${INK}, plain white background #FFFFFF,
athletic wear in teal ${ACCENT} — both the top and the shorts in teal,
plain unbranded white sneakers with no markings, warm taupe gray
equipment, not cool steel, one soft contact shadow, no gym scenery.`;

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

/**
 * Пул внешности. Только тон кожи и волосы — без возраста и телосложения.
 * Категории ("a Black woman") модель глушит о собственный дефолт,
 * физическое описание — нет. Проверено на тестах.
 * Порядок менять нельзя: индекс детерминирован по хешу и завязан на позицию.
 */
export const FIGURE_POOL = [
  "a woman with deep brown skin and short natural coily hair",
  "a man with deep brown skin and a short afro",
  "a woman with dark brown skin and box braids",
  "a man with dark brown skin and short twists",
  "a woman with light brown skin and straight black hair tied in a bun",
  "a man with light brown skin and straight black hair",
  "a woman with medium brown skin and long dark wavy hair",
  "a man with medium brown skin, black wavy hair and a short beard",
  "a woman with olive skin and dark hair tied back",
  "a man with olive skin and short dark curly hair",
  "a woman with pale skin and a blonde ponytail",
  "a man with pale skin and short brown hair",
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
in every panel. The figure fills the panel vertically, occupying at
least 85% of the panel height, vertically centered.

Eye level. A small numeral ${INK} in the top-left corner of each panel.
A thin dark gray arrow in each panel after the first, showing the
direction the body or the load travels.

Numerals only — no words, no letters, no labels, no logos, no
watermark. Aspect ratio 3:2, 1536x1024.`;
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
