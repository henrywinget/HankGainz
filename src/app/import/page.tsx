import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { desc, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { imports, setCorrections, workoutSets } from "@/db/schema";
import { Card, CardTitle, PageHeader, PageSkeleton } from "@/components/ui";
import { Dropzone } from "@/components/dropzone";
import { fixSet } from "@/app/actions";
import { kgToLb } from "@/lib/units";

export const metadata: Metadata = { title: "Import" };

const SOURCE_LABEL: Record<string, string> = {
  strong: "Strong",
  mfp_nutrition: "MFP Nutrition",
  mfp_measurement: "MFP Weight",
  mfp_exercise: "MFP Lifts",
  apple_health_steps: "Apple Health Steps",
};

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import" kicker="Feed the machine" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card accent="cyan" className="lg:col-span-7">
          <CardTitle sub="Files are saved to data/raw/uploads and never leave this machine">Upload exports</CardTitle>
          <Dropzone />
          <HowTo />
        </Card>
        <div className="grid content-start gap-4 lg:col-span-5">
          <Suspense fallback={<PageSkeleton />}>
            <Flagged />
            <History />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function Flagged() {
  await connection();
  const db = getDb();
  const flagged = db.select().from(workoutSets).where(isNotNull(workoutSets.flagReason)).all();
  const corrected = db.select().from(setCorrections).orderBy(desc(setCorrections.createdAt)).all();

  return (
    <Card accent={flagged.length ? "orange" : "mint"}>
      <CardTitle sub="Outliers are flagged instead of trusted">Review queue</CardTitle>
      {flagged.length === 0 && <p className="text-sm text-mint">All clear. No suspicious sets.</p>}
      <div className="space-y-3">
        {flagged.map((s) => (
          <form key={s.id} action={fixSet} className="rounded-xl border border-orange/30 bg-orange/5 p-3 text-sm">
            <input type="hidden" name="id" value={s.id} />
            <div className="font-medium">{s.exerciseRaw}</div>
            <div className="text-xs text-muted">{s.workoutStart.replace("T", " ")} · set {s.setIndex} · <span className="text-orange">{kgToLb(s.weightKg ?? 0).toFixed(1)} lb × {s.reps}</span></div>
            <div className="mt-1 text-[11px] text-faint">{s.flagReason}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input name="weightLb" type="number" step="0.5" min="0" placeholder="Correct lb" className="w-28 rounded-lg border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-cyan" />
              <button name="action" value="set_weight" className="rounded-lg bg-cyan/15 px-3 py-1 text-xs font-semibold text-cyan hover:bg-cyan/25">Fix weight</button>
              <button name="action" value="accept" className="rounded-lg bg-mint/10 px-3 py-1 text-xs font-semibold text-mint hover:bg-mint/20">It&apos;s right</button>
              <button name="action" value="exclude" className="rounded-lg bg-red/10 px-3 py-1 text-xs font-semibold text-red hover:bg-red/20">Exclude</button>
            </div>
          </form>
        ))}
      </div>
      {corrected.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-faint">Saved corrections (survive re-imports)</p>
          <ul className="space-y-1 text-xs text-muted">
            {corrected.map((c) => (
              <li key={c.id}>
                {c.workoutStart.slice(0, 10)} · {c.exerciseRaw} · set {c.setIndex}: {c.action === "set_weight" ? `→ ${kgToLb(c.weightKg ?? 0).toFixed(1)} lb` : c.action}
                {c.reason && <span className="text-faint">: {c.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

async function History() {
  await connection();
  const db = getDb();
  const rows = db.select().from(imports).orderBy(desc(imports.importedAt)).limit(25).all();
  return (
    <Card accent="purple">
      <CardTitle sub="Re-uploading an identical file is skipped">Import history</CardTitle>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing imported yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-display text-[10px] tracking-wider text-cyan">{SOURCE_LABEL[r.source] ?? r.source}</span>
                <span className="truncate text-muted">{r.fileName}</span>
              </div>
              <div className="mt-0.5 text-xs text-faint">
                {new Date(r.importedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {r.rowsWritten.toLocaleString()} rows
                {r.warnings.length > 0 && <span className="text-orange"> · {r.warnings.length} warning{r.warnings.length > 1 ? "s" : ""}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HowTo() {
  const steps = [
    { app: "Strong", how: "Profile → Settings → Export Strong Data → save the CSV." },
    { app: "MyFitnessPal", how: "Settings → Export Data (Premium) → upload the emailed ZIP. Nutrition, weight, and any strength sets logged before Strong are used." },
    { app: "Apple Health", how: "Health app → your profile → Export All Health Data → upload export.zip (only steps are read)." },
  ];
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.app} className="rounded-xl border border-line bg-white/3 p-3">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest text-pink">{s.app}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{s.how}</p>
        </div>
      ))}
    </div>
  );
}
