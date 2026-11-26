# Data sources

All three sources come in as **manual exports**. Eventually they're uploaded through the app's Import page. For now they sit in `data/raw/<source>/`. Everything below was **verified against Hank's real exports (Nov 2026)**.

The importer must accept these files both **zipped and unzipped**, since Hank keeps both forms.

---

## Strong: workouts (`data/raw/strong/strong_workouts.csv`)

- Comma-delimited, header row:
  `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE`
- One row per set. Current export: 6,442 rows, 190 workouts, 50 exercises, Feb 9 – Nov 23 2026.
- `Date` = workout start, local wall-clock time, **no timezone** (`2026-02-09 20:00:05`). The date part is used as-is. Hank is on Central time (America/Chicago, configurable in Settings).
- **Units: lb** (app setting; not labeled in file).
- `Set Order` values:
  - integer → working set
  - `W` → warm-up set (345 rows). Exclude from volume, hard sets, and e1RM.
  - `Rest Timer` → **not a set** (3,049 rows, almost half the file). `Seconds` holds the rest duration. Drop these, but optionally keep avg rest per exercise as a metric.
- `Duration`: `40m`, `1h 6m`. Parse to seconds.
- `Weight` on bodyweight moves (Pull Up, Chest Dip) = **added load** (0, 10, 25 lb). Effective load = bodyweight (nearest weigh-in) + added.
- `Chest Dip (Assisted)` logs 0. Treat as reps-only.
- Cardio (`Stair master `, Cycling, Swimming, Rowing) uses `Seconds` / `Distance`.
- Exercise names have trailing spaces (`"Stair master "`) and curly apostrophes (`Farmer’s Carry`). Trim and normalize before mapping.
- `RPE` is always empty. `Notes` rarely used.
- **Known bad data:** `2026-09-11 17:43:21 Incline Bench Press (Smith Machine) 1451 lb × 6` was a typo, **corrected to 145 lb** via `set_corrections`. The importer flags any set > 2.5× that exercise's median weight; fix, accept or exclude it on the Import page. Corrections survive re-imports.
- Full-history export every time → upsert on natural key.

## MyFitnessPal: nutrition & weight

Hank has Premium. Nutrition + Measurement are always used; `Exercise-Summary` is used only for **strength sets logged before Hank switched to Strong**.

### `Nutrition-Summary-<from>-to-<to>.csv`
- Header: `Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Vitamin A,Vitamin C,Calcium,Iron,Note`
- One row per meal per day (`Breakfast`, `Lunch`, `Dinner`, `Snacks`). 1,065 rows, 310 days, Jan 20 – Nov 25 2026. No duplicate (date, meal).
- Cholesterol/sodium/potassium in mg; vitamins & minerals appear to be **% daily value**, not absolute amounts.
- **Fast days**: 2026-05-01, 05-02, 09-04, 09-05 are 0 kcal. **These are real fasts (confirmed)** and count as 0 intake. Today (in progress) is partial and excluded.
- **Big day**: 2026-09-20 = 7,850 kcal. **Real (confirmed).** Every logged day is accurate and fully counted; big days are surfaced, not dropped.

### `Measurement-Summary-<from>-to-<to>.csv`
- `Date,Weight`. Weight in **lb**, one per day, 298 weigh-ins. Range 147–172 lb.
- This is the source of truth for bodyweight.

### `Exercise-Summary-<from>-to-<to>.csv`
- Header: `Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Pounds,Steps,Note` (`Kilograms` instead of `Pounds` on metric accounts).
- Only `Type = Strength` rows carry `Sets` × `Reps Per Set` @ `Pounds` → expanded into one working set per set (source `mfp`, workout name "MyFitnessPal").
- **Current export (Jan 20 – Nov 25 2026) has zero Strength rows.** All 426 rows are `Cardio`: 310 "MFP iOS calorie adjustment", 21 "Gym Workout" (Jan–Jun), 95 "Strength training (weight lifting…)" (Jul–Nov) session entries with only calories/minutes. Those are ignored.
- Pre-Strong lifting (before 2026-02-09) wasn't logged as MFP strength exercises, so there's nothing to recover. **Hank won't export MFP workouts again; training data is Strong-only from here on.** The parser stays for robustness.
- **Strong wins:** MFP sets are only used on days with no Strong workout, so nothing is double counted regardless of import order.
- MFP exercise names may differ from Strong's; unmapped names are listed as import warnings. Add them as aliases in `src/config/exercises.ts`.

### ZIP (`File-Export-<from>-to-<to>.zip`)
Contains the three CSVs. The importer unzips in memory and routes each one (Exercise is used only if it has Strength rows).

## Apple Health: steps (`data/raw/apple_health/`)

Hank only needs **steps** from Apple Health.

- `export.zip` (9.6 MB) → `apple_health_export/export.xml` (218 MB) + `export_cda.xml` (ignore).
- `HKQuantityTypeIdentifierStepCount`: 96k records, **only source is `Henry’s iPhone`** (+2 manual `Health` entries). No Watch, so no cross-device dedup needed. History back to **2015-04-07**. Hank only cares about the overlap window, so charts start at the first nutrition/weight/training date (Jan 20 2026); older steps are stored but never shown.
- Records are intervals with offsets (`2026-11-25 15:29:23 -0600`). Bucket by local start date and sum per day. Store **daily totals only**.
- Ignore everything else in the export, notably:
  - `Dietary*` and `BodyMass` records, which are **written by MyFitnessPal** and would double count the MFP CSVs.
  - `Workout` (190 records, which equals the Strong workout count; Strong writes them).
  - `ActiveEnergyBurned` / `BasalEnergyBurned` are available (phone estimates). Possible future cross-check against adaptive TDEE, not MVP.
- Stream-parse with `saxes`; match on the `type` attribute and skip other elements without building objects. Parse straight from the zip stream so users don't need to unzip.
- Source name contains the owner's name. Don't surface or send it anywhere.

## Future: automated sync
- **Health Auto Export** (iOS, paid) can push daily step totals to an endpoint, which would remove the 200 MB XML step.
- MFP and Strong: no sanctioned automated export. Periodic manual upload.
