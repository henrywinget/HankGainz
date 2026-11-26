# Architecture

**Decided:** a polished Next.js web app (TypeScript) that runs locally. Hank knows JS/React well and wants to try new tech and make it look great.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)**, TypeScript strict | Server Components for data-heavy pages, Route Handlers for uploads. Node runtime only (not Edge), because we use the filesystem and native SQLite. |
| Package manager | pnpm | |
| Styling | **Tailwind CSS v4** with hand-built components (`src/components/ui.tsx`) | Miami Vice neon theme tokens in `globals.css`. shadcn was skipped: the custom look needed full control |
| Charts | **Recharts 3** (client components in `src/components/charts.tsx`); custom SVG for the rate gauge and training calendar | visx is still an option for fancier custom visuals |
| Motion | **Motion** (formerly Framer Motion) | Page transitions, animated stat counters |
| Database | **SQLite** via **Drizzle ORM** (`better-sqlite3`) at `data/processed/hankgainz.db` | Data volume is small once steps are rolled up to daily (~300 days nutrition, ~6.5k set rows, ~4k step days). Type-safe schema + migrations. |
| Validation | **Zod** | Parse every CSV row / XML record at the boundary |
| Parsing | `papaparse` (CSV), `saxes` (streaming XML), `yauzl` (streaming unzip) | Apple Health `export.xml` is 218 MB today and growing. Never buffer it. |
| Testing | **Vitest** (parsers, importer idempotency, metrics, settings) + `playwright-core` driving local Chrome/Brave for screenshots | Synthetic fixtures only |
| Insights (later) | Claude API via `@anthropic-ai/sdk`, server-side only | Opt-in, aggregates only. See CLAUDE.md rule 2. |

Pin exact versions when scaffolding. Use whatever is current stable at that time.

## Pipeline

```
Upload in app (drag-drop ZIP/CSV/XML)  ──┐
   or files placed in data/raw/<source>/ ─┤
                                          ▼
                     detect source by filename/contents
                                          │  parse + validate (Zod), normalize units
                                          ▼
SQLite: workout_sets, meals, weigh_ins, daily_steps, imports, set_corrections, settings
                                          │  derive in memory per request (src/lib/dataset.ts):
                                          │  EWMA trend, rates, TDEE, e1RM, volume, performance
                                          ▼
                              Day[] grid + snapshot for the chosen range
                                          │
                     ┌────────────────────┼─────────────────────┐
                     ▼                    ▼                     ▼
                 Dashboard          Insight cards        (later) LLM weekly digest
```

Every import is recorded in an `imports` table (file hash, source, row counts, warnings). Re-uploading the same file is a no-op (matched on hash), and overlapping exports upsert on natural keys.

## Layout

```
src/
├── app/                      # routes: / goals body nutrition training relationships import settings, api/import
│   └── actions.ts            # server actions (settings, set corrections)
├── components/               # ui.tsx, charts.tsx, chart-defs.tsx, rate-gauge.tsx, training-heatmap.tsx, nav, dropzone, settings-form
├── config/                   # exercises.ts (catalog + muscles), settings.ts (schema, phase presets)
├── db/                       # schema.ts, client.ts (auto-migrates on open)
├── guidelines/               # cited thresholds (mirrors docs/GUIDELINES.md)
├── ingest/                   # strong, mfp, appleHealth, importer (detect/dedupe/write), corrections
├── insights/                 # snapshot.ts (window stats), rules.ts (coach)
├── lib/                      # dataset (loader), phases (goal phases CRUD/validation), series, dates, units, range, settings
└── metrics/                  # body (trend/rate/TDEE), training, phases (report cards), relationships, stats
scripts/                      # ingest.mts, screenshot.mts
tests/                        # vitest + synthetic fixtures
drizzle/                      # SQL migrations
```

## Next steps
- Claude-generated weekly digest (opt-in, aggregates only)
- Health Auto Export endpoint for automatic steps
- Phase planner (bulk/cut blocks), PR timeline, muscle map
