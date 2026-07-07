import type { profiles } from "./db/schema";
import { buildProfileSummary } from "./plan-prompt";
import type { QuickEquipmentItem } from "./validation/quick-workout";

type Profile = typeof profiles.$inferSelect;

const FOCUS_TARGET_HINT: Record<number, string> = {
  10: "3-4 exercises, a short warmup and a 1-2 move cooldown",
  20: "4-5 exercises with a proper warmup and cooldown",
  30: "5-6 exercises with a full warmup and cooldown",
  45: "6-8 exercises with a full warmup and cooldown",
};

export function buildQuickEquipmentSummary(
  mode: "saved" | "photo" | "none",
  items: QuickEquipmentItem[]
): string {
  if (mode === "none" || items.length === 0) {
    return "BODYWEIGHT ONLY — the user has no equipment available. Every movement must use body weight (in the library, equipment = \"body only\"), a wall, or the floor. Do not reference any equipment.";
  }
  const label = mode === "saved" ? "the user's saved gym" : "what the user photographed just now";
  const lines = items.map((i) => `- [${i.category}] ${i.name}`).join("\n");
  return `Available equipment (${label}) — use ONLY these:\n${lines}`;
}

export function buildQuickGoalSummary(chips: string[], text: string): string {
  const parts: string[] = [];
  if (chips.length > 0) parts.push(`Target areas selected: ${chips.join(", ")}.`);
  if (text.trim()) parts.push(`In their own words: "${text.trim()}".`);
  if (parts.length === 0) {
    parts.push("No specific target chosen — build a balanced full-body session.");
  }
  return parts.join("\n");
}

export function buildQuickUserMessage({
  mode,
  items,
  chips,
  text,
  timeMin,
  profile,
  compactList,
}: {
  mode: "saved" | "photo" | "none";
  items: QuickEquipmentItem[];
  chips: string[];
  text: string;
  timeMin: number;
  profile: Profile | undefined;
  compactList: string;
}): string {
  const profileBlock = profile
    ? buildProfileSummary(profile)
    : "No saved profile — assume a healthy adult of unknown experience level. Because you don't know their level, give every main exercise a genuinely easier and harder option.";

  const sizeHint = FOCUS_TARGET_HINT[timeMin] ?? FOCUS_TARGET_HINT[30];

  return `Build ONE single training session the user can do right now.

TIME AVAILABLE: ${timeMin} minutes. Aim for roughly ${sizeHint}. The sum of warmup + all working blocks (sets x reps x rest) + cooldown must realistically fit ${timeMin} minutes.

WHAT THEY WANT TO TRAIN:
${buildQuickGoalSummary(chips, text)}

${buildQuickEquipmentSummary(mode, items)}

USER PROFILE:
${profileBlock}

VALID EXERCISE LIBRARY (tab-separated: id, name, equipment, primary muscles) — you may ONLY use ids from this list for "exerciseId":
${compactList || "(none — use exerciseId: null with a described movement in nameOverride and howTo instead)"}`;
}

export function buildQuickSystemPrompt(): string {
  return `You are GymSnap's AI coach. You design a SINGLE workout for right now — not a weekly plan.

Hard rules you must always follow:
1. Use ONLY the equipment stated in the user message. If it says "BODYWEIGHT ONLY", every movement must be bodyweight (library equipment = "body only"), a wall, or the floor — no bands, dumbbells, or machines.
2. For each main working block, prefer an exercise from the VALID EXERCISE LIBRARY and reference it by its exact "exerciseId". Never invent an id. For movements not in the library — mobility drills, stretches, or specific rehab work like ankle circles or neck decompression — set "exerciseId" to null, put the movement name in "nameOverride", and give clear step-by-step instructions in the block/segment text.
3. The user does NOT know their own fitness level in the moment. Give EVERY main block a genuinely easier option AND a genuinely harder option (regression and progression).
4. Respect ALL injuries and limitations from the profile:
   - Sensitive knees: avoid jumping, deep knee flexion, high-impact plyometrics.
   - Lower back issues: avoid heavy axial spinal loading; prefer supported variants.
   - Shoulder issues: avoid unsupported overhead pressing and behind-the-neck movements.
   - Honor anything in the free-text injury notes.
5. ACUTE PAIN / FRESH INJURY: if the request describes something acute ("twisted my ankle yesterday", "sudden sharp pain", "tweaked my back this morning"), do NOT program any loading or stretching of that area. Instead: (a) add a gentle, plain-language note in "cautions" recommending they see a doctor/physio if pain is sharp, persistent, or worsening, and (b) if it's safe, build a session that trains OTHER, unaffected areas only. State clearly in "cautions" that you avoided the injured area. When in doubt, keep it conservative.
6. Match the number of exercises to the time available (about 3-4 for 10 min, 6-8 for 45 min) and always include a short warmup and cooldown appropriate to the focus.
7. "whyIncluded" should be one short sentence tying the exercise to the user's stated goal or limitations.
8. Respond only by calling the report_quick_workout tool — no prose.`;
}
