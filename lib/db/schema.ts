import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const gyms = sqliteTable("gyms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
});

export const gymPhotos = sqliteTable("gym_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gymId: integer("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  createdAt: text("created_at").notNull(),
});

export const equipmentItems = sqliteTable("equipment_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  createdAt: text("created_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  injuryKnees: integer("injury_knees", { mode: "boolean" }).notNull().default(false),
  injuryLowerBack: integer("injury_lower_back", { mode: "boolean" })
    .notNull()
    .default(false),
  injuryShoulders: integer("injury_shoulders", { mode: "boolean" })
    .notNull()
    .default(false),
  cardioIncline: integer("cardio_incline", { mode: "boolean" }).notNull().default(false),
  cardioRunning: integer("cardio_running", { mode: "boolean" }).notNull().default(false),
  cardioBike: integer("cardio_bike", { mode: "boolean" }).notNull().default(false),
  cardioElliptical: integer("cardio_elliptical", { mode: "boolean" })
    .notNull()
    .default(false),
  cardioMinimal: integer("cardio_minimal", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  equipment: text("equipment"),
  category: text("category"),
  level: text("level"),
  force: text("force"),
  mechanic: text("mechanic"),
  primaryMuscles: text("primary_muscles").notNull().default("[]"),
  secondaryMuscles: text("secondary_muscles").notNull().default("[]"),
  instructions: text("instructions").notNull().default("[]"),
  images: text("images").notNull().default("[]"),
});

export const weeks = sqliteTable("weeks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekNumber: integer("week_number").notNull(),
  createdAt: text("created_at").notNull(),
});

export const days = sqliteTable("days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const exerciseEntries = sqliteTable("exercise_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  unverified: integer("unverified", { mode: "boolean" }).notNull().default(false),
});

export const checkins = sqliteTable("checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id, { onDelete: "cascade" }),
  overallComment: text("overall_comment").default(""),
  wellbeing: integer("wellbeing").notNull(),
  kneesRating: integer("knees_rating").notNull(),
  lowerBackRating: integer("lower_back_rating").notNull(),
  createdAt: text("created_at").notNull(),
});

export const dayCheckins = sqliteTable("day_checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  checkinId: integer("checkin_id")
    .notNull()
    .references(() => checkins.id, { onDelete: "cascade" }),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["completed", "partial", "skipped"] }).notNull(),
});
