import { pgTable, serial, text, integer, boolean, jsonb, timestamp, real, index } from "drizzle-orm/pg-core";

export const gyms = pgTable(
  "gyms",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (t) => [index("gyms_user_id_idx").on(t.userId)]
);

export const gymPhotos = pgTable("gym_photos", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const equipmentItems = pgTable("equipment_items", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["cardio", "strength_machine", "free_weights", "accessories"],
  }).notNull(),
  details: text("details").default(""),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull(),
  source: text("source", { enum: ["recognized", "manual"] }).notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  ageGroup: text("age_group", {
    enum: ["25-34", "35-44", "45-54", "55+"],
  }).notNull(),
  bodyWeight: real("body_weight").notNull(),
  weightUnit: text("weight_unit", { enum: ["kg", "lbs"] }).notNull(),
  sex: text("sex", { enum: ["male", "female", "other"] }).notNull(),
  experience: text("experience", {
    enum: ["beginner", "intermediate", "advanced", "returning"],
  }).notNull(),
  goal: text("goal", {
    enum: ["weight_loss", "muscle_gain", "strength", "general_fitness"],
  }).notNull(),
  daysPerWeek: integer("days_per_week").notNull(),
  sessionLength: text("session_length", {
    enum: ["30-40", "45-60", "60-90"],
  }).notNull(),
  injuriesText: text("injuries_text").default(""),
  injuryKnees: boolean("injury_knees").notNull().default(false),
  injuryLowerBack: boolean("injury_lower_back").notNull().default(false),
  injuryShoulders: boolean("injury_shoulders").notNull().default(false),
  cardioIncline: boolean("cardio_incline").notNull().default(false),
  cardioRunning: boolean("cardio_running").notNull().default(false),
  cardioBike: boolean("cardio_bike").notNull().default(false),
  cardioElliptical: boolean("cardio_elliptical").notNull().default(false),
  cardioMinimal: boolean("cardio_minimal").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
}, (t) => [index("profiles_user_id_idx").on(t.userId)]);

export const exercises = pgTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  equipment: text("equipment"),
  category: text("category"),
  level: text("level"),
  force: text("force"),
  mechanic: text("mechanic"),
  primaryMuscles: jsonb("primary_muscles").$type<string[]>().notNull().default([]),
  secondaryMuscles: jsonb("secondary_muscles").$type<string[]>().notNull().default([]),
  instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
  images: jsonb("images").$type<string[]>().notNull().default([]),
});

export const weeks = pgTable(
  "weeks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    weekNumber: integer("week_number").notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
    // 2-3 optional weekly stretching blocks (bonus — not part of completion).
    stretchBlocks: jsonb("stretch_blocks")
      .$type<
        {
          title: string;
          targetMuscles: string[];
          items: { exerciseId: string | null; nameOverride: string | null; howTo: string; duration: string }[];
        }[]
      >()
      .notNull()
      .default([]),
  },
  (t) => [index("weeks_user_id_idx").on(t.userId)]
);

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  dayLabel: text("day_label").notNull(),
  focus: text("focus").notNull(),
  warmup: text("warmup").notNull().default(""),
  // Structured warmup moves; the "warmup" text stays as a short summary/fallback.
  warmupItems: jsonb("warmup_items")
    .$type<{ exerciseId: string | null; nameOverride: string | null; howTo: string; duration: string }[]>()
    .notNull()
    .default([]),
  cooldown: text("cooldown").notNull().default(""),
  cardioType: text("cardio_type"),
  cardioDurationMin: integer("cardio_duration_min"),
  cardioIncline: text("cardio_incline"),
  cardioTargetHr: text("cardio_target_hr"),
  // Actual cardio minutes the user logged for this day (null = not logged).
  // Kept separate from exercise set logs so it never counts toward the
  // strength "X/Y saved" progress, but can still mark a cardio-only day done.
  cardioActualMin: integer("cardio_actual_min"),
});

export const exerciseEntries = pgTable("exercise_entries", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  exerciseId: text("exercise_id").references(() => exercises.id),
  nameOverride: text("name_override"),
  sets: integer("sets").notNull(),
  reps: text("reps").notNull(),
  weight: text("weight").notNull().default(""),
  restSec: integer("rest_sec").notNull().default(60),
  notes: text("notes").default(""),
  unverified: boolean("unverified").notNull().default(false),
  // Up to 3 fallback exercises (occupied-equipment backups). Shown behind a
  // button in the UI and excluded from the printed PDF.
  alternatives: jsonb("alternatives")
    .$type<{ exerciseId: string | null; nameOverride: string | null; note: string }[]>()
    .notNull()
    .default([]),
});

// Actual performed sets for a planned exercise entry — the workout diary.
// The plan (exercise_entries) holds the prescription; this holds what the user
// really did. loggedAt is set server-side so the diary date is automatic.
export const exerciseSetLogs = pgTable(
  "exercise_set_logs",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => exerciseEntries.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    setNumber: integer("set_number").notNull(),
    weight: real("weight"),
    weightUnit: text("weight_unit", { enum: ["kg", "lbs"] }).notNull(),
    reps: integer("reps"),
    toFailure: boolean("to_failure").notNull().default(false),
    loggedAt: timestamp("logged_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (t) => [
    index("exercise_set_logs_user_id_idx").on(t.userId),
    index("exercise_set_logs_entry_id_idx").on(t.entryId),
  ]
);

export const checkins = pgTable("checkins", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id, { onDelete: "cascade" }),
  overallComment: text("overall_comment").default(""),
  wellbeing: integer("wellbeing").notNull(),
  kneesRating: integer("knees_rating").notNull(),
  lowerBackRating: integer("lower_back_rating").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const dayCheckins = pgTable("day_checkins", {
  id: serial("id").primaryKey(),
  checkinId: integer("checkin_id")
    .notNull()
    .references(() => checkins.id, { onDelete: "cascade" }),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["completed", "partial", "skipped"] }).notNull(),
});

// One-off "Train now" sessions — independent of the weekly plan flow.
// Stores both the generated workout (result) and the inputs that produced it
// so the /quick screen can list history and repeat a past session's inputs.
export const quickWorkouts = pgTable("quick_workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  equipmentMode: text("equipment_mode", {
    enum: ["saved", "photo", "none"],
  }).notNull(),
  // Human-readable list of equipment that was available for this session
  // (empty for bodyweight-only). Kept flat so "Repeat" can restore the input.
  equipment: jsonb("equipment")
    .$type<{ name: string; category: string }[]>()
    .notNull()
    .default([]),
  focusChips: jsonb("focus_chips").$type<string[]>().notNull().default([]),
  focusText: text("focus_text").notNull().default(""),
  timeMin: integer("time_min").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
}, (t) => [index("quick_workouts_user_id_idx").on(t.userId)]);

// Short-lived one-time codes for merging a second device into an existing
// anonymous account. Claiming a code re-points the claiming device's cookie at
// the code owner's user_id, then the code is deleted.
export const syncCodes = pgTable("sync_codes", {
  code: text("code").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ---- Nutrition ----

// Everyone the household cooks for: the user (isSelf) plus family members. Body
// metrics + goal drive the deterministic calorie/macro engine (lib/nutrition.ts).
export const eaters = pgTable(
  "eaters",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    name: text("name").notNull().default(""),
    isSelf: boolean("is_self").notNull().default(false),
    sex: text("sex", { enum: ["male", "female", "other"] }).notNull(),
    ageYears: integer("age_years").notNull(),
    heightCm: real("height_cm").notNull(),
    weightKg: real("weight_kg").notNull(),
    activity: text("activity", {
      enum: ["sedentary", "light", "moderate", "active", "very_active"],
    }).notNull(),
    goal: text("goal", { enum: ["lose", "maintain", "gain"] }).notNull(),
    dietary: jsonb("dietary").$type<string[]>().notNull().default([]),
    allergies: jsonb("allergies").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (t) => [index("eaters_user_id_idx").on(t.userId)]
);

// One-off "Cook now" sessions — a recipe generated from what the user has on
// hand. Mirrors quick_workouts.
export const quickMeals = pgTable(
  "quick_meals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    source: text("source", { enum: ["photo", "manual"] }).notNull(),
    ingredients: jsonb("ingredients")
      .$type<{ name: string; category?: string }[]>()
      .notNull()
      .default([]),
    mealType: text("meal_type").notNull().default("any"),
    servings: integer("servings").notNull().default(1),
    note: text("note").notNull().default(""),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (t) => [index("quick_meals_user_id_idx").on(t.userId)]
);

// Account-level food preferences + location for local availability. One row per
// user (upserted).
export const nutritionSettings = pgTable("nutrition_settings", {
  userId: text("user_id").primaryKey(),
  country: text("country").notNull().default(""),
  region: text("region").notNull().default(""),
  city: text("city").notNull().default(""),
  cuisines: jsonb("cuisines").$type<string[]>().notNull().default([]),
  likes: jsonb("likes").$type<string[]>().notNull().default([]),
  dislikes: jsonb("dislikes").$type<string[]>().notNull().default([]),
  budgetLevel: text("budget_level", { enum: ["low", "medium", "high"] }),
  // Optional manual override of the computed daily calorie target (per eater).
  calorieTargetOverride: integer("calorie_target_override"),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});
