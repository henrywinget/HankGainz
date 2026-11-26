# Metrics & insights

All thresholds referenced here are defined, with citations, in `GUIDELINES.md`.

## Metric definitions

**Weight trend:** EWMA of daily weigh-ins, α = 0.1 (≈ 10–20 day smoothing). Missing days carry the previous trend. **Rate** = linear-regression slope of the trend over the last 14 and 28 days, expressed as lb/week and %BW/month.

**Adaptive TDEE:** over a rolling 28-day window of *logged* days (fasts count as 0 kcal):
`TDEE ≈ avg_kcal − (Δtrend_kg × 7700) / days`. Show a confidence level based on % complete days and weigh-in count. (Sanity check on real data: last 28 days averaged ~2,920 kcal while the trend fell ~1 lb → TDEE ≈ 3,050.)

**e1RM:** Epley, working sets with ≤ 10 reps, best per session. Bodyweight moves use nearest-weigh-in BW + added load.

**Hard sets:** working sets per muscle group per ISO week; primary = 1, secondary = 0.5.

**Tonnage:** Σ weight × reps, working sets.

**Protein g/kg:** daily protein ÷ trend weight (kg).

**Session performance index:** for each key lift trained that day, best e1RM ÷ best e1RM in the prior 60 days × 100, averaged across lifts (100 = matched recent best).

**Connections (correlations):** weekly avg kcal vs weekly trend change (regression → empirical maintenance), session performance vs prior-3-day kcal / protein and prior-day steps, same-day steps vs kcal. Minimum n = 10. Always labeled as correlation.

## Phase awareness
Every judgment uses the goal phase it belongs to: the current rate is measured only inside the current phase (min(28, days in phase), ≥ 14 days, ±0.1 %/mo tolerance); protein days are scored against that day's phase floor; strength stalls during a cut are reframed ("holding strength is the goal"). Phase report cards (Goals page) give each phase: trend change, regression rate vs target (graded, except off plan), avg kcal, protein g/lb + % days on target, sessions/week, steps, key-lift e1RM first 3 weeks vs last 3 weeks, and for an off-plan phase after a cut, the % of the cut regained. Insights `phase.current` (always first) and `phase.previous` (last completed phase, if it ended ≤ 45 days ago).

## Coach tone
`win` = encouragement, `info` = context, `warn` = heads-up, `harsh` = reality check (red). Sorted harsh → warn → win → info. Direct, never insulting; acknowledges honest logging.

## Insight catalogue

### Tier 1: rules (MVP)
| id | Insight | Trigger (see GUIDELINES) |
|---|---|---|
| `weight.rate` | Rate-of-gain status (gauge on Body page + card when not green) | 28-day slope vs. warning bands for current phase |
| `weight.spike` | Rapid change | 14-day slope > 3 %BW/month |
| `tdee.update` | Maintenance estimate + suggested intake for target rate | weekly |
| `tdee.drift` | Maintenance moved > 150 kcal vs. 4 weeks ago | |
| `protein.status` | On target / below for 7-day avg | `protein.daily.*` |
| `protein.distribution` | A meal consistently < 20 g protein | `protein.perMeal` |
| `lift.pr` | New e1RM or rep PR this week | |
| `lift.stall` | No e1RM best ≥ 4 weeks, with context (deficit? volume drop?) | `progress.stall*` |
| `volume.range` | Muscle group < 6 or > 25 hard sets/week; also below 10 for 3+ weeks | `volume.target.weekly` |
| `data.quality` | Flagged outliers awaiting review; unlogged days | `logging.*` |

### Tier 2: correlational (after MVP)
- e1RM progress rate in surplus vs. deficit weeks
- Session performance vs. prior 3 days' kcal/protein
- Steps vs. TDEE

Always show n and effect size; suppress when n is below the minimum; label as correlation.

### Tier 3: LLM weekly digest (opt-in, built)
`src/insights/digest-input.ts` builds the payload: last 8 complete ISO weeks of aggregates, current rate/maintenance, targets, Hank's stated preferences, tier-1 insights, guideline summaries. **No raw rows, notes, meal or device names.** `src/insights/digest.ts` sends it to `claude-opus-5-5` (effort `medium`, server-side refusal fallback, Zod structured output: headline, verdict, summary, wins, reality checks, 3 focus actions). Results are cached in `digests` by (week, payload hash), so re-pressing the button with unchanged data costs nothing. Only runs when Hank presses the button. Roughly 2–3k input tokens per digest.
