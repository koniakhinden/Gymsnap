import type { profiles, equipmentItems } from "./db/schema";
import type { FullWeek } from "./plan-data";

type Profile = typeof profiles.$inferSelect;
type EquipmentItem = typeof equipmentItems.$inferSelect;

export function buildProfileSummary(profile: Profile): string {
  const injuries: string[] = [];
  if (profile.injuryKnees) injuries.push("sensitive knees");
  if (profile.injuryLowerBack) injuries.push("lower back issues");
  if (profile.injuryShoulders) injuries.push("shoulder issues");
  const injuryLine =
    injuries.length > 0
      ? `Flagged limitations: ${injuries.join(", ")}.`
      : "No flagged joint limitations.";

  const cardioPrefs: string[] = [];
  if (profile.cardioIncline) cardioPrefs.push("incline walking");
  if (profile.cardioRunning) cardioPrefs.push("running");
  if (profile.cardioBike) cardioPrefs.push("bike");
  if (profile.cardioElliptical) cardioPrefs.push("elliptical");
  if (profile.cardioMinimal) cardioPrefs.push("prefers minimal cardio");

  return [
    `Age group: ${profile.ageGroup}`,
    `Sex: ${profile.sex}`,
    `Body weight: ${profile.bodyWeight} ${profile.weightUnit}`,
    `Experience: ${profile.experience}`,
    `Goal: ${profile.goal}`,
    `Training days per week: ${profile.daysPerWeek}`,
    `Session length: ${profile.sessionLength} minutes`,
    injuryLine,
    profile.injuriesText ? `Free-text notes: "${profile.injuriesText}"` : "",
    `Cardio preference: ${cardioPrefs.length ? cardioPrefs.join(", ") : "no preference stated"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildEquipmentSummary(items: EquipmentItem[]): string {
  if (items.length === 0) return "No equipment recorded.";
  return items
    .map((i) => `- [${i.category}] ${i.name}${i.details ? ` (${i.details})` : ""}`)
    .join("\n");
}

export function buildHistorySummary(history: FullWeek[]): string {
  if (history.length === 0) return "No previous weeks yet — this is week 1.";
  return history
    .map((week) => {
      const dayLines = week.days
        .map((d) => {
          const status = d.checkinStatus ?? "no check-in";
          const exParts = d.exercises.map((e) => {
            const name = e.nameOverride ?? e.exercise?.name ?? "unknown exercise";
            if (e.logs.length === 0) return name;
            // Actual performed sets, so progression reacts to real numbers.
            const done = e.logs
              .map((l) => {
                const w = l.weight != null ? `${l.weight}${l.weightUnit}` : "bw";
                const r = l.toFailure ? "AMRAP" : l.reps != null ? `${l.reps}` : "?";
                return `${w}x${r}`;
              })
              .join(", ");
            return `${name} [actual: ${done}]`;
          });
          return `  - ${d.dayLabel} (${d.focus}): ${status}. Exercises: ${
            exParts.join("; ") || "none"
          }`;
        })
        .join("\n");
      const checkinLine = week.checkin
        ? `  Wellbeing ${week.checkin.wellbeing}/5, knees ${week.checkin.kneesRating}/5, lower back ${week.checkin.lowerBackRating}/5. Comment: "${
            week.checkin.overallComment || "none"
          }"`
        : "  No check-in submitted for this week yet.";
      return `Week ${week.weekNumber}:\n${dayLines}\n${checkinLine}`;
    })
    .join("\n\n");
}

export function buildPlanSystemPrompt(): string {
  return `You are GymSnap's AI strength & conditioning coach. You write one week of a home/commercial gym training plan at a time.

Hard constraints you must always follow:
1. Only use exercises from the "VALID EXERCISE LIBRARY" list provided in the user message, referencing them by their exact id. Never invent an exercise id. If no library exercise fits, set "exerciseId" to null and put a short exercise description in "nameOverride" instead (only equipment already listed as available may be described this way).
2. Respect ALL injuries/limitations from the profile:
   - Sensitive knees: avoid jumping, deep knee flexion (deep squats/lunges), and high-impact plyometrics.
   - Lower back issues: avoid heavy axial spinal loading (e.g. heavy barbell back squats, deadlifts, overhead barbell pressing) and any exercise noted as high spinal-compression risk; prefer supported/machine variants.
   - Shoulder issues: avoid unsupported overhead pressing and behind-the-neck movements.
   - Also account for anything mentioned in the free-text injury notes.
3. Every training day must include a brief warmup and cooldown (as plain text describing what to do, e.g. "5 min easy bike + arm circles").
4. Progressive overload must be conservative: compared to the most recent previous week for the same or similar exercises, total working load (sets x reps x weight, or duration for cardio) must not increase by more than 5-10% per week. If check-in feedback reports pain, low wellbeing, or a skipped/partial day, hold or reduce load instead of progressing.
5. Only include a "cardio" block on a day if it fits the user's stated cardio preference and available cardio equipment; otherwise set cardio to null for that day.
6. Number of days in the plan must equal the user's requested training days per week, and total time per day (warmup + exercises + cardio + cooldown) should roughly fit their requested session length.
7. Respond only by calling the report_week_plan tool — no prose.

LOAD BALANCING — pick exercises by target EFFORT, not by "what equipment unlocks":
8. Every exercise must land at roughly RIR 2-3 (RPE 7-8) for THIS user, given their body weight and experience level. Choose the variant that hits that effort. Equipment is secondary — a movement pattern covered at the right effort beats a "fancier" movement done far too light or far too hard.
9. Think in movement PATTERNS (push / pull / squat / hinge / core / calf) and cover them, rather than picking isolated items. When bodyweight ladders are provided in the user message, treat each ladder as ordered easiest -> hardest and put the user on the rung that produces RIR 2-3:
   - Heavier / deconditioned / beginner users → an EASIER rung (more upright push angle, more vertical row torso, chair-capped or assisted squats, seated/lying/supported variants). Avoid impact and deep-loaded movements at the start (no jumping, deep lunges, or full floor push-ups for a heavy beginner).
   - Stronger / lighter users → a HARDER rung.
10. Never prescribe a load that is near-zero relative to body weight (e.g. a 3 kg dumbbell compound for a 100 kg user) — that is essentially no stimulus. If the only free weights are too light to reach RIR 2-3 on a compound, switch that movement to an angle-scaled bodyweight ladder rung (for pull: the horizontal row whose difficulty scales with torso angle) instead of a token dumbbell. Do NOT place a near-zero-effort exercise and a near-maximal (barely-possible) exercise in the same day.
11. Progress by ADDING WEIGHT only when the equipment allows it. When the load is fixed (bodyweight or a single light implement), progress mechanically in THIS priority order: reps → sets → tempo (3-4 s eccentric) → pauses → range of motion → unilateral → shorter rest → change leverage (support angle / height). State the applied progression cue briefly in the exercise "notes".`;
}
