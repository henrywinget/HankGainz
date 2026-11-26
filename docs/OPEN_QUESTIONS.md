# Open questions

When a question is resolved, move the decision into the relevant spec doc and delete it here.

## Resolved (Nov 25 2026)
- Stack: Next.js 16 / TypeScript / SQLite. Display units: lb (Strong set to lb).
- MFP: Premium; Nutrition + Measurement (+ pre-Strong strength rows if present). Apple Health: steps only (iPhone).
- **0-kcal days are real fasts and every logged day is accurate**, including the 7,850 kcal day (2026-09-20).
- 1,451 lb Smith incline set (2026-09-11) was a typo → corrected to 145 lb (stored in `set_corrections`).
- Time zone: Central (America/Chicago).
- Targets: GUIDELINES defaults, adjustable in Settings (done).
- Look: Miami Vice / 80s neon, dark, high contrast. Tone: encouragement + harsh reality checks.
- Version control: Hank will set up git himself.
- Only the overlap window matters: charts start Jan 20 2026; long-term steps aren't needed.
- MFP workouts before Strong: importer supports MFP strength rows, but Hank's export has none (calorie/minute entries only). **Training data is Strong-only going forward**; no more MFP workout exports.
- Bodyweight e1RM (Pull Up / Dip) = trend bodyweight + added load: keep.
- AI weekly digest: approved (aggregates only, button-triggered). Built; needs `ANTHROPIC_API_KEY` in `.env.local`.
- Volume: compound-focused, accessories only for "showy" muscles (arms). Light side delts/calves/etc. is intentional → only **focus muscles** (editable in Settings) are judged. Sessions planned at **3–4/week**, capped at ~4 to limit gym time.
- Set types: Strong only exports `W`; Hank rarely does drop sets and avoids failure. `D`/`F` markers, if they ever appear, count as working sets.
- Protein targets shown in **g per lb** (stored as g/kg internally because the cited research uses g/kg).

## Still open
_Nothing right now._
