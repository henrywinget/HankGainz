# Data model

Defined in `src/db/schema.ts` (Drizzle, SQLite). Internal units are metric (**kg, kcal, g, s**). Hank's **display unit is lb**, and conversion happens only in the UI formatting layer. Store full precision so 145 lb → kg → lb round-trips exactly at display rounding.

Dates: `local_date` (`YYYY-MM-DD`) is the primary grouping key. Timestamps stored as ISO strings with offset.

## Source tables

### `imports`
`id, source (strong|mfp_nutrition|mfp_measurement|apple_health), file_name, file_sha256 (unique), imported_at, rows_read, rows_upserted, warnings_json`

### `workout_sets` (Strong)
| column | notes |
|---|---|
| id | |
| source | `strong` \| `mfp` (MFP strength entries, used only on days without a Strong workout) |
| workout_start | ISO local timestamp |
| local_date | |
| workout_name | |
| workout_duration_s | |
| exercise_raw | trimmed, normalized |
| exercise_id | FK → exercise catalog (`src/config/exercises.ts`) |
| set_index | int; warm-ups keep their position |
| set_type | `working` \| `warmup` |
| weight_kg | added load for bodyweight moves |
| reps | |
| distance_m, duration_s | cardio |
| notes | |
| flagged | bool, outlier awaiting review |

Natural key: `(source, workout_start, exercise_raw, set_type, set_index)`. Each source's re-import replaces only its own rows in the file's date range. `Rest Timer` rows are not stored.

### `set_corrections`
`natural_key, field, corrected_value, reason`, applied on every rebuild so fixes survive re-imports.

### `meals` (MFP Nutrition)
`local_date, meal, kcal, protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g, sodium_mg, potassium_mg, cholesterol_mg`
Natural key: `(local_date, meal)`. Vitamin %DV columns are ignored for MVP.

### `weigh_ins` (MFP Measurement)
`local_date (PK), weight_kg`

### `phases` (goal history)
`id, kind (lean_gain|maintain|cut|off_plan), start_date, end_date (null = ongoing), note, rate_min/max_pct_per_month, protein_min/max_g_per_kg` (target columns are optional overrides of the kind's preset). No overlaps (validated in `src/lib/phases.ts`); gaps mean "no goal".

### `digests` (AI weekly digests)
`week_start, input_hash (unique together), created_at, model, payload (exactly what was sent), content, input/output tokens`.

### `daily_steps` (Apple Health)
`local_date (PK), steps`

## Exercise catalog (`src/config/exercises.ts`, checked in)
`id, displayName, aliases[] (raw Strong names), primaryMuscles[], secondaryMuscles[], pattern (squat|hinge|h-push|v-push|h-pull|v-pull|isolation|cardio), loadType (barbell|dumbbell|machine|cable|bodyweight|cardio), isKeyLift`

Key lifts (tracked for progress): **Squat, Bench Press, Deadlift, Overhead Press, Bent Over Row** (all barbell), plus Pull Up (weighted). These are Hank's top 6 by volume.

## Derived data (in memory, per request)

`buildDataset()` in `src/lib/dataset.ts` loads the source tables and builds a `Day[]` grid from the first nutrition/weight/training date to today:

| field | derivation |
|---|---|
| weightKg / trendKg | weigh-in; EWMA trend (α 0.1, carried over gaps) |
| kcal, proteinG, carbsG, fatG, fiberG | Σ meals. **null = not logged or today**; 0 = real fast |
| isFast | logged and < 100 kcal |
| steps | daily total (null for today) |
| trained, workingSets, tonnageKg | working, non-cardio sets |
| perfScore | session performance index (see INSIGHTS.md) |

`buildSnapshot()` (`src/insights/snapshot.ts`) summarizes a selected range (7d to all) for the pages and the coach. No derived tables are persisted, so nothing can go stale.

`settings` stores one JSON value per key; a missing key means "use the default" (e.g. `kcalTarget` = auto).
