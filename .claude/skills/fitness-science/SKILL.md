---
name: fitness-science
description: Evidence rules for any HankGainz feature that judges, warns about, or recommends anything about nutrition, bodyweight, or training (thresholds, insight cards, rate-of-gain warnings, protein/volume targets, LLM insight prompts). Use before writing or changing such logic or copy.
---

# Fitness science rules for HankGainz

1. **Single source of truth.** Every number used to judge Hank's data comes from `docs/GUIDELINES.md`, implemented in `src/guidelines/`. Never hardcode a threshold in a component, rule, or prompt. Import it from the guidelines module.
2. **Adding or changing a guideline:** update `docs/GUIDELINES.md` first (value, evidence grade A/B/C, citation link), then the typed module, then tests. If you can't find a credible source, mark it grade C and word it as a rule of thumb.
3. **Wording.**
   - Grade A/B: "Research suggests…" / "The ISSN recommends…"
   - Grade C: "A common rule of thumb is…"
   - Correlations from Hank's own data: "In your data, X tended to coincide with Y (n = …)". Never claim causation.
   - No medical diagnoses. For worrying patterns, suggest checking with a doctor.
4. **Judge trends, not points.** Bodyweight decisions use the EWMA trend slope (14/28-day), never single weigh-ins. Respect minimum-data requirements; when data is insufficient, say so instead of guessing.
5. **Respect data quality.** Exclude incomplete nutrition days and flagged outliers per GUIDELINES.md before computing anything.
6. **Goals are configurable.** Read the current phase/targets from settings; don't assume "lean gain" in code.
7. **LLM prompts** (tier-3 insights) receive the relevant guideline entries plus pre-computed aggregates, and must not compute numbers themselves.
