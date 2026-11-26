"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { savePhaseAction, startPhaseAction, deletePhaseAction, type ActionState } from "@/app/actions";
import { PHASES, PHASE_LABEL, PHASE_PRESETS, type Phase } from "@/config/settings";
import { gPerKgToGPerLb } from "@/lib/units";
import { cn } from "@/lib/cn";

export interface PhaseFormValue {
  id: number | null;
  kind: Phase;
  start: string;
  end: string | null;
  note: string | null;
  rateMinPctPerMonth: number | null;
  rateMaxPctPerMonth: number | null;
  proteinMinGPerKg: number | null;
  proteinMaxGPerKg: number | null;
}

const input = "w-full rounded-lg border border-line bg-bg/70 px-2.5 py-1.5 text-sm tabular-nums outline-none transition focus:border-pink";
const lbl = "font-display text-[9px] font-bold uppercase tracking-[0.2em] text-faint";
const r2 = (n: number) => Math.round(n * 100) / 100;

function Fields({ v, kind, setKind, withEnd }: { v?: PhaseFormValue; kind: Phase; setKind: (k: Phase) => void; withEnd: boolean }) {
  const preset = PHASE_PRESETS[kind];
  const noRate = kind === "off_plan";
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <label className="sm:col-span-2">
        <span className={lbl}>Goal</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Phase)} className={input}>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className={lbl}>Start</span>
        <input name="start" type="date" required defaultValue={v?.start} className={input} />
      </label>
      {withEnd && (
        <label className="sm:col-span-2">
          <span className={lbl}>End (blank = ongoing)</span>
          <input name="end" type="date" defaultValue={v?.end ?? ""} className={input} />
        </label>
      )}
      <label className={withEnd ? "sm:col-span-6" : "sm:col-span-2"}>
        <span className={lbl}>Note (optional)</span>
        <input name="note" defaultValue={v?.note ?? ""} placeholder="e.g. holiday season, getting back on track" className={input} maxLength={140} />
      </label>
      <div className="sm:col-span-3">
        <span className={lbl}>Rate % BW/month {noRate ? "(not judged off plan)" : "(blank = default)"}</span>
        <div className="flex items-center gap-2">
          <input name="rateMinPctPerMonth" type="number" step="0.05" disabled={noRate} defaultValue={v?.rateMinPctPerMonth ?? ""} placeholder={String(preset.rateMinPctPerMonth)} className={input} />
          <span className="text-faint">to</span>
          <input name="rateMaxPctPerMonth" type="number" step="0.05" disabled={noRate} defaultValue={v?.rateMaxPctPerMonth ?? ""} placeholder={String(preset.rateMaxPctPerMonth)} className={input} />
        </div>
      </div>
      <div className="sm:col-span-3">
        <span className={lbl}>Protein g/lb (blank = default)</span>
        <div className="flex items-center gap-2">
          <input name="proteinMinGPerLb" type="number" step="0.01" defaultValue={v?.proteinMinGPerKg != null ? r2(gPerKgToGPerLb(v.proteinMinGPerKg)) : ""} placeholder={r2(gPerKgToGPerLb(preset.proteinMinGPerKg)).toFixed(2)} className={input} />
          <span className="text-faint">to</span>
          <input name="proteinMaxGPerLb" type="number" step="0.01" defaultValue={v?.proteinMaxGPerKg != null ? r2(gPerKgToGPerLb(v.proteinMaxGPerKg)) : ""} placeholder={r2(gPerKgToGPerLb(preset.proteinMaxGPerKg)).toFixed(2)} className={input} />
        </div>
      </div>
    </div>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <span className={cn("text-xs", state.ok ? "text-mint" : "text-red")}>{state.message}</span>;
}

const btn = "rounded-lg px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50";

/** "My goal changed": closes the ongoing phase and starts a new one. */
export function StartPhaseForm({ today, currentKind }: { today: string; currentKind: Phase | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(startPhaseAction, null);
  const [kind, setKind] = useState<Phase>(currentKind === "cut" ? "maintain" : "cut");
  return (
    <form action={action} className="space-y-3">
      <Fields kind={kind} setKind={setKind} withEnd={false} v={{ id: null, kind, start: today, end: null, note: null, rateMinPctPerMonth: null, rateMaxPctPerMonth: null, proteinMinGPerKg: null, proteinMaxGPerKg: null }} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={cn(btn, "bg-gradient-to-r from-pink to-purple text-white shadow-[0_0_20px_-6px_var(--pink)]")}>{pending ? "Starting…" : "Start new phase"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PhaseRow({ phase, children }: { phase: PhaseFormValue; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<Phase>(phase.kind);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await savePhaseAction(prev, fd);
    if (r?.ok) setEditing(false);
    return r;
  }, null);

  return (
    <div className="rounded-xl border border-line bg-white/3 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setEditing((e) => !e)} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-cyan" aria-label={editing ? "Cancel editing" : "Edit phase"}>
            {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <form action={deletePhaseAction} onSubmit={(e) => { if (!confirm("Delete this phase?")) e.preventDefault(); }}>
            <input type="hidden" name="id" value={phase.id ?? ""} />
            <button className="rounded-lg p-1.5 text-muted hover:bg-red/10 hover:text-red" aria-label="Delete phase"><Trash2 className="size-4" /></button>
          </form>
        </div>
      </div>
      {editing && (
        <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
          <input type="hidden" name="id" value={phase.id ?? ""} />
          <Fields v={phase} kind={kind} setKind={setKind} withEnd />
          <div className="flex items-center gap-3">
            <button disabled={pending} className={cn(btn, "bg-cyan/15 text-cyan hover:bg-cyan/25")}>{pending ? "Saving…" : "Save phase"}</button>
            <Status state={state} />
          </div>
        </form>
      )}
      {!editing && state && !state.ok && <div className="mt-2"><Status state={state} /></div>}
    </div>
  );
}

/** Add a phase with explicit dates (for back-filling history). */
export function AddPhaseForm() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Phase>("lean_gain");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await savePhaseAction(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, null);
  if (!open) return (
    <div className="flex items-center gap-3">
      <button onClick={() => setOpen(true)} className={cn(btn, "inline-flex items-center gap-1.5 border border-line text-muted hover:border-cyan hover:text-cyan")}><Plus className="size-3.5" /> Add past phase</button>
      <Status state={state} />
    </div>
  );
  return (
    <form action={action} className="space-y-3 rounded-xl border border-cyan/30 bg-cyan/5 p-3">
      <Fields kind={kind} setKind={setKind} withEnd />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={cn(btn, "bg-cyan/15 text-cyan hover:bg-cyan/25")}>{pending ? "Adding…" : "Add phase"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-faint hover:text-muted">Cancel</button>
        <Status state={state} />
      </div>
    </form>
  );
}
