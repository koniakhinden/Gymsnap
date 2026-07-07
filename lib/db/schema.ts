import { pgTable, serial, text, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";

export const gyms = pgTable("gyms", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

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
});

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

export const weeks = pgTable("weeks", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  dayLabel: text("day_label").notNull(),
  focus: text("focus").notNull(),
  warmup: text("warmup").notNull().default(""),
  cooldown: text("cooldown").notNull().default(""),
  cardioType: text("cardio_type"),
  cardioDurationMin: integer("cardio_duration_min"),
  cardioIncline: text("cardio_incline"),
  cardioTargetHr: text("cardio_target_hr"),
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
});

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
});
