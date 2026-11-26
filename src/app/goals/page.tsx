import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { buildDataset } from "@/lib/dataset";
import { readPhases } from "@/lib/phases";
import { allPhaseReports, type PhaseReport } from "@/metrics/phases";
import { Card, CardTitle, PageHeader, PageSkeleton } from "@/components/ui";
import { AddPhaseForm, PhaseRow, StartPhaseForm, type PhaseFormValue } from "@/components/phase-forms";
import { PHASE_COLOR } from "@/config/phase-colors";
import { PHASE_LABEL } from "@/config/settings";
import { daysBetween, fmtShort } from "@/lib/dates";
import { kgToLb, fmtInt, fmtGPerLb } from "@/lib/units";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader title="Goals" kicker="What were you going for, and how did it go?" />
      <Suspense fallback={<PageSkeleton />}>
        <Goals />
      </Suspense>
    </>
  );
}

const TONE_COLOR = { good: "var(--mint)", warn: "var(--orange)", bad: "var(--red)" } as const;
const signed = (n: number, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)}`;
const range = (r: PhaseReport) => `${fmtShort(r.from)} to ${r.ongoing ? "now" : fmtShort(r.to)}`;

async function Goals() {
  await connection();
  const db = getDb();
  const ds = buildDataset(db);
  const stored = readPhases(db);
  const reports = allPhaseReports(ds);
  const first = ds.days[0]?.date ?? ds.today;
  const span = Math.max(1, daysBetween(first, ds.today) + 1);

  return (
    <div className="space-y-4">
      <Card accent="pink">
        <CardTitle sub={`${fmtShort(first)} to today · the coach judges every day against the goal it belonged to`}>Timeline</CardTitle>
        <div className="flex h-12 w-full overflow-hidden rounded-xl border border-line bg-white/3">
          {reports.map((r) => {
            const w = ((daysBetween(r.from, r.to) + 1) / span) * 100;
            const c = PHASE_COLOR[r.phase.kind];
            return (
              <div
                key={`${r.phase.kind}-${r.from}`}
                className="relative flex min-w-0 flex-col justify-center px-2"
                style={{ width: `${w}%`, background: `color-mix(in srgb, ${c} 16%, transparent)`, boxShadow: `inset 0 -3px 0 ${c}` }}
                title={`${PHASE_LABEL[r.phase.kind]} · ${range(r)}`}
              >
                <span className="truncate font-display text-[10px] font-bold uppercase tracking-wider" style={{ color: c }}>{PHASE_LABEL[r.phase.kind]}</span>
                <span className="truncate text-[10px] text-faint">{r.trendStartKg && r.trendEndKg ? `${signed(kgToLb(r.trendEndKg - r.trendStartKg))} lb` : ""}</span>
              </div>
            );
          })}
        </div>
        {!stored.length && <p className="mt-3 text-sm text-orange">No phases defined yet. Everything is judged against your Settings goal. Add your history below.</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {[...reports].reverse().map((r) => <ReportCard key={`${r.phase.kind}-${r.from}`} r={r} />)}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <Card accent="mint">
            <CardTitle sub="Ends the current phase yesterday and starts this one">Goal changed?</CardTitle>
            <StartPhaseForm today={ds.today} currentKind={ds.currentPhase?.kind ?? null} />
          </Card>
          <Card accent="cyan">
            <CardTitle sub="Edit dates, goals and per-phase targets. Phases can't overlap.">All phases</CardTitle>
            <div className="space-y-2">
              {[...stored].reverse().map((p) => {
                const v: PhaseFormValue = {
                  id: p.id, kind: p.kind, start: p.start, end: p.end, note: p.note,
                  rateMinPctPerMonth: p.overridden ? p.targets.rateMinPctPerMonth : null, rateMaxPctPerMonth: p.overridden ? p.targets.rateMaxPctPerMonth : null,
                  proteinMinGPerKg: p.overridden ? p.targets.proteinMinGPerKg : null, proteinMaxGPerKg: p.overridden ? p.targets.proteinMaxGPerKg : null,
                };
                const c = PHASE_COLOR[p.kind];
                return (
                  <PhaseRow key={p.id} phase={v}>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                      <span className="font-medium">{PHASE_LABEL[p.kind]}</span>
                      <span className="text-xs text-faint">{fmtShort(p.start)} to {p.end ? fmtShort(p.end) : "ongoing"}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      {p.kind !== "off_plan" && <>rate {p.targets.rateMinPctPerMonth} to {p.targets.rateMaxPctPerMonth}%/mo · </>}
                      protein {fmtGPerLb(p.targets.proteinMinGPerKg)} to {fmtGPerLb(p.targets.proteinMaxGPerKg)} g/lb{p.overridden && " (custom)"}
                      {p.note && <> · <span className="text-muted">&ldquo;{p.note}&rdquo;</span></>}
                    </div>
                  </PhaseRow>
                );
              })}
            </div>
            <div className="mt-3"><AddPhaseForm /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ r }: { r: PhaseReport }) {
  const c = PHASE_COLOR[r.phase.kind];
  const delta = r.trendStartKg && r.trendEndKg ? kgToLb(r.trendEndKg - r.trendStartKg) : null;
  const t = r.phase.targets;
  return (
    <section className="card p-5" style={{ ["--accent" as string]: c }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em]" style={{ color: c }}>{PHASE_LABEL[r.phase.kind]}</h2>
            {r.ongoing && <span className="rounded-full bg-pink/15 px-2 py-0.5 text-[10px] font-semibold text-pink">current</span>}
          </div>
          <p className="text-xs text-faint">{range(r)} · {r.days} days{r.phase.note && <> · &ldquo;{r.phase.note}&rdquo;</>}</p>
        </div>
        {r.verdict && <span className="rounded-full border px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider" style={{ color: TONE_COLOR[r.verdict.tone], borderColor: TONE_COLOR[r.verdict.tone] }}>{r.verdict.label}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Trend change" value={delta != null ? `${signed(delta)} lb` : "—"} sub={r.trendStartKg && r.trendEndKg ? `${kgToLb(r.trendStartKg).toFixed(1)} → ${kgToLb(r.trendEndKg).toFixed(1)}` : undefined} color={c} />
        <Metric label="Rate" value={r.ratePctPerMonth != null ? `${signed(r.ratePctPerMonth, 2)}%/mo` : "—"} sub={r.phase.kind === "off_plan" ? "no target" : `target ${t.rateMinPctPerMonth} to ${t.rateMaxPctPerMonth}`} />
        <Metric label="Avg calories" value={fmtInt(r.avgKcal)} sub={`${r.loggedDays} days logged`} />
        <Metric label="Protein" value={r.avgProteinGPerKg != null ? `${fmtGPerLb(r.avgProteinGPerKg)} g/lb` : "—"} sub={r.proteinHitPct != null ? `${Math.round(r.proteinHitPct * 100)}% of days ≥ ${fmtGPerLb(t.proteinMinGPerKg)}` : undefined} />
        <Metric label="Sessions / wk" value={r.sessionsPerWeek.toFixed(1)} />
        <Metric label="Avg steps" value={fmtInt(r.avgSteps)} />
      </div>

      {r.regainOfPrevious != null && r.regainOfPrevious > 0 && (
        <p className="mt-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">
          Regained about {Math.round(r.regainOfPrevious * 100)}% of the weight lost in the cut before it.
        </p>
      )}

      {r.lifts.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-faint">Strength · first vs last 3 weeks (e1RM)</p>
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {r.lifts.map((l) => {
              const d = kgToLb(l.endKg - l.startKg);
              return (
                <div key={l.liftId} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted">{l.name}</span>
                  <span className="tabular-nums">
                    {Math.round(kgToLb(l.startKg))} → {Math.round(kgToLb(l.endKg))}{" "}
                    <span className={d > 2 ? "text-mint" : d < -5 ? "text-red" : "text-faint"}>({signed(d, 0)})</span>
                  </span>
                </div>
              );
            })}
          </div>
          {r.phase.kind === "cut" && <p className="mt-1.5 text-[11px] text-faint">In a cut, holding these steady is the win.</p>}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-faint">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
