# HankGainz

Neon-soaked personal dashboard that combines **MyFitnessPal** nutrition + weight, **Apple Health** steps and **Strong** workouts, then coaches you with evidence-based wins, warnings and reality checks. Local-first: your data never leaves your machine.

## Quick start

```bash
nvm use            # Node 24
pnpm install
pnpm ingest        # imports everything in data/raw/
pnpm dev           # → http://127.0.0.1:3000
```

Or skip `pnpm ingest` and drag exports onto the **Import** page.

### Optional: AI weekly digest
Create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-…`, restart `pnpm dev`, then press **Write weekly digest** on the Overview. Only weekly aggregates are sent (see "What gets sent?" on the card), and only when you press the button.

## Getting your data

| App | Export | Drop into |
|---|---|---|
| Strong | Settings → Export Strong Data (CSV) | `data/raw/strong/` |
| MyFitnessPal | Settings → Export Data (Premium, ZIP) | `data/raw/myfitnesspal/` |
| Apple Health | Health → profile → Export All Health Data (`export.zip`) | `data/raw/apple_health/` |

Re-importing is safe: identical files are skipped and overlapping exports replace their date range.

See `CLAUDE.md` and `docs/` for architecture, data model and the cited guidelines behind every recommendation.
