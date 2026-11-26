# Evidence-based guidelines

This is the knowledge base behind HankGainz recommendations. Every threshold the app uses to judge data or make a recommendation must come from this file. It will be implemented as typed, cited config in `src/guidelines/`. Rules:

- Each guideline has an **id, value/range, evidence grade, and citation**. The UI shows the citation on hover/tap.
- Grades: **A** = position stand or meta-analysis; **B** = controlled trial(s); **C** = coaching consensus / expert heuristic. Grade C must be worded as "rule of thumb," never as established fact.
- All thresholds are **defaults Hank can override** in Settings. His goals change.
- The app gives training and nutrition guidance, not medical advice. If something looks medically concerning (e.g. rapid unexplained weight loss), say "consider checking with a doctor," not a diagnosis.
- Review this file roughly once a year or when a major new position stand or meta-analysis comes out.

Hank's goal profile (Nov 2026): **lean gain**, building muscle while staying lean, flexible between phases. Bodyweight ~162–165 lb; ~10 months of consistent logged training (intermediate).

---

## Bodyweight rate of change

| id | Guideline | Value | Grade | Source |
|---|---|---|---|---|
| `rate.leanGain.intermediate` | Target gain rate, intermediate lifter | **0.5–1.0 % BW / month** (~0.8–1.6 lb/mo, ~0.2–0.4 lb/wk at 162 lb) | C | Coaching frameworks (e.g. beginner 1–1.5 %, intermediate 0.5–1 %, advanced 0.25–0.5 %/mo) |
| `rate.surplus.small` | Prefer small surpluses; large ones mostly add fat | ~5 % above maintenance (≈ 150–300 kcal/day) | B | 2023 RCT (Sports Med Open), 21 trained lifters, maintenance vs. +5 % vs. +15 % surplus over 8 wk; small/short study ([PMC10620361](https://pmc.ncbi.nlm.nih.gov/articles/PMC10620361/)) |
| `rate.cut.max` | Upper limit on loss rate if cutting (preserve muscle) | ~0.5–1.0 % BW / week | C | Common evidence-based coaching guidance; verify before shipping cut mode |

### Warning bands, computed on the **28-day slope of the weight trend**

General rule for any phase: inside [min, max] (±0.1 %/mo tolerance) = on target; up to 0.5 %/mo outside = yellow; beyond that = red. Phase presets: lean gain 0.5–1.0, maintain −0.5–0.5, cut −4 to −2 %/mo (≈ 0.5–1 %/week). For lean gain this gives:

| Band | Rate (%BW / month) | At 162 lb | Message |
|---|---|---|---|
| 🔴 Too fast | > 1.5 % | > ~2.4 lb/mo | "Gaining faster than lean-gain range, likely adding more fat than muscle. Consider trimming ~150–250 kcal/day." |
| 🟡 Fast | 1.0–1.5 % | 1.6–2.4 lb/mo | "Upper edge of lean-gain range." |
| 🟢 On target | 0.5–1.0 % | 0.8–1.6 lb/mo | |
| 🟡 Slow | 0–0.5 % | 0–0.8 lb/mo | "Gaining slower than target. Consider adding ~100–200 kcal/day." |
| 🔴 Losing | < 0 % for ≥ 3 weeks | | "Trend is down while in a gain phase." |

Plus a **short-window spike check**: a 14-day trend slope > 3 %/month triggers "rapid change" even if the 28-day number still looks fine. This catches things early. (Hank's real data shows the trend rising ~9 lb between late Aug and late Oct 2026, which these rules would have flagged within ~2 weeks.)

Notes: water/glycogen swings make the first 1–2 weeks of any calorie change noisy. Never warn off raw daily weights, only off the trend, and require a minimum number of weigh-ins (≥ 8 in the 14-day window).

## Protein

| id | Guideline | Value | Grade | Source |
|---|---|---|---|---|
| `protein.daily.gain` | Daily intake for building/maintaining muscle | **1.4–2.0 g/kg/day** (~100–147 g at 162 lb) | A | ISSN Position Stand: Protein and Exercise, Jäger et al. 2017 ([PubMed 28642676](https://pubmed.ncbi.nlm.nih.gov/28642676/)) |
| `protein.daily.cut` | Higher intake to retain lean mass in a deficit | 2.3–3.1 g/kg/day | A | Same |
| `protein.perMeal` | Per-meal dose, spread every 3–4 h | 0.25 g/kg or 20–40 g | A | Same |

Default target for Hank: **1.6–2.2 g/kg = 0.73–1.0 g/lb** (the app displays and edits g/lb; it stores g/kg because the research is in g/kg). The low end matches the point of diminishing returns in most research; the high end gives margin. This is an opinionated default, so make it configurable. His 2026 average (~175 g/day, ~2.4 g/kg) is already above the range, so the protein insight should be "consistently on target," not a nag. MFP meal-level data lets us show per-meal distribution (Breakfast often lower).

## Training volume

| id | Guideline | Value | Grade | Source |
|---|---|---|---|---|
| `volume.doseResponse` | More weekly sets → more hypertrophy, with diminishing returns | graded relationship | A | Schoenfeld, Ogborn & Krieger 2017 meta-analysis ([PubMed 27433992](https://pubmed.ncbi.nlm.nih.gov/27433992/)); Pelland et al. (preprint, fractional set counting) |
| `volume.target.weekly` | Practical range per muscle group | **~10–20 hard sets/week**; flag < 6 as "low," > 25 as "very high" | B/C | 2022 systematic review suggesting 12–20 sets for trained men ([PubMed 35291645](https://pubmed.ncbi.nlm.nih.gov/35291645/)) |
| `volume.counting` | How sets count | direct = 1, indirect (secondary muscle) = 0.5; warm-ups = 0 | B | Pelland et al. fractional method |

## Steps

| id | Guideline | Value | Grade | Source |
|---|---|---|---|---|
| `steps.daily` | Mortality benefit rises with steps and levels off ~8,000–10,000/day for adults < 60 | default goal **8,000** | A | Paluch et al., Lancet Public Health 2022, meta-analysis of 15 cohorts ([PubMed 35247352](https://pubmed.ncbi.nlm.nih.gov/35247352/)) |

## Progression & e1RM

| id | Guideline | Value | Grade |
|---|---|---|---|
| `e1rm.formula` | Epley: `w × (1 + reps/30)`; only use sets with ≤ 10 reps; take best set per session | | C (standard estimator; less accurate at high reps) |
| `progress.stall` | No new e1RM best on a key lift for ≥ 4 weeks while training it ≥ 1×/wk | | C |
| `progress.stall.context` | Before suggesting program changes, check whether the stall coincides with a calorie deficit, a drop in that muscle's volume, or lower training frequency | | C |

## Logging completeness

| id | Rule | Grade |
|---|---|---|
| `logging.complete` | **Every logged day is real** (Hank confirmed): 0-kcal fast days and very large days count fully. Only unlogged days and today (in progress) are excluded. | Hank's call |
| `logging.bigDay` | Days > 2× the window's median kcal are surfaced as "blowout days" (still counted) | C |

---

## Third-party Claude skills reviewed (Nov 2026)

Checked so we don't reinvent the wheel. **None were adopted as-is.** They're community-maintained and unvetted, they're built for chat coaching rather than an app's rule engine, and their thresholds aren't cited the way this file requires. They're worth reading for ideas when building tier-3 LLM insights:

- NousResearch *hermes-agent* `fitness-nutrition`: coach/nutritionist persona + offline calculators ([skills.sh](https://skills.sh/nousresearch/hermes-agent/fitness-nutrition))
- *Science-Based Lifter*: training-program and meal-plan skills derived from research ([README](https://cdn.jsdelivr.net/gh/borisghidaglia/science-based-lifter@main/README.md))
- *Fitness Tools* (Jeffallan): body composition, rep-max, macro calculators ([site](https://jeffallan.github.io/Fitness-Tools/))

Instead, this project keeps its **own** project skill at `.claude/skills/fitness-science/`. It tells Claude (while building) to source every threshold from this file. The same guideline module will later feed the in-app LLM prompt, so the app's narrative insights and its rule engine always agree.
