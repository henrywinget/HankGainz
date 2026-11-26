import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/** One row per imported file. Re-importing the same bytes (same sha256) is a no-op. */
export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(), // strong | mfp_nutrition | mfp_measurement | apple_health_steps
  fileName: text("file_name").notNull(),
  sha256: text("sha256").notNull(),
  importedAt: text("imported_at").notNull(),
  rowsRead: integer("rows_read").notNull(),
  rowsWritten: integer("rows_written").notNull(),
  warnings: text("warnings", { mode: "json" }).$type<string[]>().notNull(),
}, (t) => [uniqueIndex("imports_source_sha").on(t.source, t.sha256)]);

/** One row per set (Strong, or MFP strength entries from before Strong). Rest-timer rows are never stored. Weights in kg. */
export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source", { enum: ["strong", "mfp"] }).notNull().default("strong"),
  workoutStart: text("workout_start").notNull(), // local wall-clock "YYYY-MM-DDTHH:mm:ss"
  localDate: text("local_date").notNull(),
  workoutName: text("workout_name").notNull(),
  workoutDurationS: integer("workout_duration_s"),
  exerciseRaw: text("exercise_raw").notNull(),
  exerciseId: text("exercise_id").notNull(),
  setIndex: integer("set_index").notNull(),
  setType: text("set_type", { enum: ["working", "warmup"] }).notNull(),
  weightKg: real("weight_kg"),
  reps: integer("reps"),
  distanceM: real("distance_m"),
  durationS: real("duration_s"),
  notes: text("notes"),
  flagReason: text("flag_reason"), // non-null => outlier awaiting review
  corrected: integer("corrected", { mode: "boolean" }).notNull().default(false),
}, (t) => [
  uniqueIndex("workout_sets_nk").on(t.source, t.workoutStart, t.exerciseRaw, t.setType, t.setIndex),
  index("workout_sets_date").on(t.localDate),
]);

/** Manual fixes to Strong sets, keyed by natural key so they survive full re-imports. */
export const setCorrections = sqliteTable("set_corrections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutStart: text("workout_start").notNull(),
  exerciseRaw: text("exercise_raw").notNull(),
  setType: text("set_type").notNull(),
  setIndex: integer("set_index").notNull(),
  action: text("action", { enum: ["set_weight", "exclude", "accept"] }).notNull(),
  weightKg: real("weight_kg"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("set_corrections_nk").on(t.workoutStart, t.exerciseRaw, t.setType, t.setIndex)]);

/** MyFitnessPal Nutrition Summary: one row per meal per day. Every logged day is treated as accurate (incl. 0-kcal fast days). */
export const meals = sqliteTable("meals", {
  localDate: text("local_date").notNull(),
  meal: text("meal").notNull(),
  kcal: real("kcal").notNull(),
  proteinG: real("protein_g").notNull(),
  carbsG: real("carbs_g").notNull(),
  fatG: real("fat_g").notNull(),
  satFatG: real("sat_fat_g"),
  fiberG: real("fiber_g"),
  sugarG: real("sugar_g"),
  sodiumMg: real("sodium_mg"),
  potassiumMg: real("potassium_mg"),
  cholesterolMg: real("cholesterol_mg"),
}, (t) => [primaryKey({ columns: [t.localDate, t.meal] })]);

/** MyFitnessPal Measurement Summary. */
export const weighIns = sqliteTable("weigh_ins", {
  localDate: text("local_date").primaryKey(),
  weightKg: real("weight_kg").notNull(),
});

/** Apple Health StepCount rolled up per local day. */
export const dailySteps = sqliteTable("daily_steps", {
  localDate: text("local_date").primaryKey(),
  steps: integer("steps").notNull(),
});

/** Claude-written weekly digests. Cached per (week, input hash) so unchanged data never triggers a second API call. */
export const digests = sqliteTable("digests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekStart: text("week_start").notNull(),
  inputHash: text("input_hash").notNull(),
  createdAt: text("created_at").notNull(),
  model: text("model").notNull(),
  /** Exactly what was sent (aggregates only), kept for transparency. */
  payload: text("payload", { mode: "json" }).notNull(),
  content: text("content", { mode: "json" }).notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
}, (t) => [uniqueIndex("digests_week_hash").on(t.weekStart, t.inputHash)]);

/**
 * Goal phases: date ranges of what Hank was trying to do (lean gain, cut…), so coaching and
 * retrospectives judge each period against the goal it actually had. end_date null = ongoing.
 * Target columns are optional overrides of the phase preset.
 */
export const phases = sqliteTable("phases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["lean_gain", "maintain", "cut", "off_plan"] }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  note: text("note"),
  rateMinPctPerMonth: real("rate_min_pct_per_month"),
  rateMaxPctPerMonth: real("rate_max_pct_per_month"),
  proteinMinGPerKg: real("protein_min_g_per_kg"),
  proteinMaxGPerKg: real("protein_max_g_per_kg"),
}, (t) => [index("phases_start").on(t.startDate)]);

/** User-adjustable settings (targets, timezone…) as JSON values. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});
