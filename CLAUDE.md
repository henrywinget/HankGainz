# HankGainz

A personal, local-first **Next.js** app that brings together **nutrition + bodyweight** (MyFitnessPal), **steps** (Apple Health), and **strength training** (Strong). It stores them in one SQLite database, shows them as neon 80s / Miami Vice-styled interactive charts, and coaches with evidence-based insights: encouragement when things go well, harsh reality checks when they don't.

Single user (Hank). Experienced JS/React dev who wants modern tooling and visual polish.

@AGENTS.md

## Status

**MVP built (Nov 2026).** Import (CLI + drag-and-drop), Overview, Body, Nutrition, Training, Connections, Import, Settings, rule-based coach. Next ideas are in `docs/PRODUCT.md` § Later.

| Doc | What it covers |
|---|---|
| `docs/PRODUCT.md` | Goals, questions the app answers, MVP vs. later |
| `docs/DATA_SOURCES.md` | Verified export formats + quirks of Hank's real files |
| `docs/DATA_MODEL.md` | SQLite/Drizzle schema + derived metrics |
| `docs/ARCHITECTURE.md` | Stack, layout, pipeline |
| `docs/INSIGHTS.md` | Metric definitions + insight catalogue + tone |
| `docs/GUIDELINES.md` | Cited thresholds behind every recommendation |
| `docs/OPEN_QUESTIONS.md` | Undecided items |

Project skill `.claude/skills/fitness-science/` applies to any code or copy that judges or recommends.

## Commands

```bash
nvm use               # Node 24 (see .nvmrc; Next 16 needs ≥ 20.9; zlib.crc32 needs ≥ 22.2)
pnpm install
pnpm ingest           # import everything under data/raw/** (idempotent)
pnpm dev              # http://127.0.0.1:3000 (bound to localhost on purpose)
pnpm test             # vitest, synthetic fixtures only
pnpm typecheck        # next typegen && tsc
pnpm lint
pnpm build
pnpm db:generate      # after editing src/db/schema.ts → new migration in drizzle/ (auto-applied on startup; restart dev)
pnpm exec tsx scripts/screenshot.mts http://127.0.0.1:3000 <outDir>   # headless screenshots via local Chrome/Brave
```

## Hard rules

1. **Health data never leaves the machine unless Hank explicitly opts in.** `data/` is gitignored (raw exports, uploads, DB, screenshots). Never commit real data. Tests use `tests/fixtures/` only.
2. **LLM use is opt-in and minimized.** The weekly digest sends only what `src/insights/digest-input.ts` builds (aggregates, targets, insights, guideline summaries), only when Hank presses the button. Never raw files, notes, or source/device names (they contain Hank's name). Keep the test in `tests/digest.test.ts` that guards this.
3. **Raw exports are immutable.** Never modify files in `data/raw/`. Uploads land in `data/raw/uploads/` (kept only if they imported data).
4. **Ingestion is idempotent.** Same content → skipped; overlapping exports replace their date range. Manual fixes live in `set_corrections` and are re-applied after every Strong import.
5. **Every logged nutrition day is real**, including 0-kcal fast days and huge days (Hank confirmed). Only *unlogged* days and *today* are excluded. Never treat missing as 0 or 0 as missing.
6. **Units:** store metric (kg, kcal, g, s); **display lb**, and protein targets in **g/lb** (stored as g/kg; helpers `gPerKgToGPerLb` / `gPerLbToGPerKg` in `lib/units.ts`). Convert only at the UI/series layer.
7. **Every recommendation threshold comes from `src/guidelines/` or user settings** (mirrors `docs/GUIDELINES.md`). No magic numbers in components or copy.
8. **Insights are traceable:** show basis (window, n) and guideline grade/citation. Correlation is labeled as correlation.
9. **Localhost only.** Server actions have no auth; `dev`/`start` bind to 127.0.0.1. Don't change that without adding auth.

## Goal phases
Goals change over time, so they're **date-ranged phases** (`phases` table, `src/lib/phases.ts`, Goals page): lean gain / maintain / cut / **off plan** (no rate goal; described, never graded). Each phase can override its preset rate/protein targets.
- `ds.settings` = stored settings **with phase/rate/protein taken from the current phase**. Never read those from stored settings directly.
- The current rate is measured **only within the current phase** (`snapshot.phaseRate`, window = min(28, days in phase), needs ≥ 14 days).
- Per-day judgments (e.g. protein hits) use `ds.phaseOn(date)`. Retrospectives come from `allPhaseReports()` (`src/metrics/phases.ts`).
- Hank's history: lean gain Jan 20 – Apr 7, cut Apr 8 – Sep 7, off plan Sep 8 – Nov 3, cut Nov 4 → (dates = trend turning points; he can edit them).

## Coaching preferences (Hank)
- Compound-focused; accessories only for arms. Only `settings.focusMuscles` are judged on weekly sets; never flag other muscles.
- Plans 3–4 sessions/week, capped around 4 to limit gym time. Prefers efficient sessions.
- Rarely uses drop sets, avoids failure. Training data comes from Strong only (no more MFP workouts).
- Flagged outlier sets are excluded from all metrics until reviewed on the Import page.

## Next.js 16 gotchas (this repo)

- **Cache Components is on.** `better-sqlite3` is synchronous, so DB reads must call `await connection()` first (done in `loadDataset()` and the Import/Settings pages), and request-time content must sit inside `<Suspense>`. Pages pass `searchParams` into a Suspense-wrapped child.
- Use `refresh()` from `next/cache` after mutations in server actions.
- **No functions across the server → client boundary.** Chart formatters are passed as string keys (`FormatKey` in `components/charts.tsx`).
- **Recharts doesn't render custom `<defs>` children.** Gradients/glow live once in `components/chart-defs.tsx` (rendered in the layout); reference them as `url(#neon)`, `url(#g-purple)` etc.
- Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).
- **Restart `pnpm dev` after adding a migration or installing packages.** The DB connection (and its migrations) is cached per process, and pnpm can re-link `next` under a new path, which causes a bogus "Could not find the module … in the React Client Manifest" error until restart.

## Conventions

- TypeScript strict. Server Components by default; client components only for charts/interactivity.
- One parser per source in `src/ingest/`, Zod-validated, emitting the unified schema only. Apple Health XML is stream-parsed with `saxes` straight from the zip (218 MB parses in ~1 s); only `StepCount` is read.
- Strong: `Rest Timer` rows aren't sets; `W` = warm-up (excluded from volume/e1RM); bodyweight moves log *added* load.
- Derived metrics are computed in memory per request from source tables (`src/lib/dataset.ts`); data is small.
- Group by local calendar date (records carry their own wall-clock date). "Today" uses the configured time zone (default America/Chicago).
- Theme tokens live in `src/app/globals.css` (`--pink`, `--cyan`, `--mint`…). Fonts: Orbitron (display/numbers), Outfit (body), Mr Dafoe (script accents).
- Coach tone: `win` (encouragement), `info`, `warn`, `harsh` (reality check). Be direct, never insulting; no medical advice.
