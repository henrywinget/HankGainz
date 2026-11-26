# Product spec

## Why

MyFitnessPal knows what I eat and weigh, my iPhone knows how much I move, and Strong knows what I lift. HankGainz connects them and tells me whether I'm actually building muscle while staying lean.

## Goal profile
Goals change over time (2026: lean gain → cut → off plan → cut), so they're **date-ranged goal phases** edited on the Goals page. Coaching reacts to the current phase, and past phases get report cards judged against what Hank was actually trying to do then. The app must **warn when the weight trend moves too fast or too slow** for the current phase (bands in GUIDELINES.md).

## Core questions

**Body**
- What's my real weight trend (smoothed), and how fast is it moving vs. my target rate?
- What is my actual maintenance calories (adaptive TDEE from intake vs. trend)?
- Am I in the surplus I think I am?

**Nutrition**
- Am I hitting protein (g/kg) consistently? How is it spread across meals?
- Calorie and macro trends, weekday vs. weekend patterns.

**Training**
- e1RM trend for key lifts: squat, bench, deadlift, OHP, row, weighted pull-up.
- Weekly hard sets per muscle group vs. the 10–20 range. What's under- or over-trained?
- PR timeline; stalled lifts.

**Cross-source**
- Strength progress during surplus vs. deficit periods.
- Does protein/calorie intake in the days before a session relate to performance?
- Steps (NEAT) vs. weight trend and TDEE.

## MVP
1. Import Strong CSV, MFP Nutrition + Measurement CSVs (or the MFP ZIP), and Apple Health `export.zip` (steps), via **drag-and-drop in the app** or files in `data/raw/`.
2. Import history page with warnings (outliers flagged for review, unlogged days).
3. Pages: Overview · Body · Nutrition · Training · Import.
4. Tier-1 insight cards, including rate-of-gain warnings.
5. Settings: phase, targets, timezone.

## Visual direction
Polished and modern: dark-first theme, one bold accent, smooth motion, dense-but-clean stat cards, beautiful charts with annotations (PRs, phase changes, flagged data). Responsive enough to check on a phone.

## Later
- Claude-generated weekly digest (opt-in, aggregates only)
- Auto sync (Health Auto Export for steps)
- Phase planner (bulk/cut blocks with targets), photo/measurement log
- Training heat map / muscle map visual

## Non-goals
Logging food or workouts; multi-user; cloud hosting; medical advice.
