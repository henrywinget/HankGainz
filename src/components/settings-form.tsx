"use client";

import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/actions";
import type { Settings } from "@/config/settings";
import { cn } from "@/lib/cn";
import { MUSCLE_LABEL, type Muscle } from "@/config/exercises";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

const input = "w-full rounded-xl border border-line bg-bg/70 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-pink focus:shadow-[0_0_0_3px_rgb(255_42_109/0.2)]";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, null);

  return (
    <form action={action} className="space-y-6">
      <p className="rounded-xl border border-line bg-white/3 p-3 text-sm text-muted">
        Goal type, rate of change and protein targets are set per phase on the <a href="/goals" className="text-cyan underline">Goals</a> page, so past periods are judged against what you were actually trying to do.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Hard sets / muscle / week" hint="Practical range ≈ 10 to 20.">
          <input className={input} name="setsMinPerMuscle" type="number" step="1" defaultValue={s.setsMinPerMuscle} aria-label="min sets" />
          <span className="text-faint">to</span>
          <input className={input} name="setsMaxPerMuscle" type="number" step="1" defaultValue={s.setsMaxPerMuscle} aria-label="max sets" />
        </Field>
        <Field label="Sessions / week" hint="Your plan: 3 to 4. Warns above the cap so gym time doesn't creep.">
          <input className={input} name="sessionsMinPerWeek" type="number" step="0.5" defaultValue={s.sessionsMinPerWeek} aria-label="min sessions" />
          <span className="text-faint">to</span>
          <input className={input} name="sessionsMaxPerWeek" type="number" step="0.5" defaultValue={s.sessionsMaxPerWeek} aria-label="max sessions" />
        </Field>
        <Field label="Daily step goal" hint="Benefits level off around 8–10k for adults under 60.">
          <input className={input} name="stepGoal" type="number" step="500" defaultValue={s.stepGoal} />
        </Field>
        <Field label="Calorie target (optional)" hint="Leave blank to use adaptive maintenance + your target rate.">
          <input className={input} name="kcalTarget" type="number" step="10" defaultValue={s.kcalTarget ?? ""} placeholder="auto" />
        </Field>
        <Field label="Time zone" hint="Decides what “today” is.">
          <input className={input} name="timeZone" defaultValue={s.timeZone} />
        </Field>
      </div>

      <Field label="Focus muscles" hint="Only these are held to the weekly-sets target. Unchecked muscles still show on charts (grey) but never trigger warnings.">
        <input type="hidden" name="focusMusclesSubmitted" value="1" />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
            <label key={m} className="cursor-pointer">
              <input type="checkbox" name="focusMuscles" value={m} defaultChecked={s.focusMuscles.includes(m)} className="peer sr-only" />
              <span className="block rounded-full border border-line px-3 py-1 text-xs text-faint transition peer-checked:border-mint peer-checked:bg-mint/10 peer-checked:text-text">
                {MUSCLE_LABEL[m]}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <div className="flex items-center gap-4">
        <button
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-pink to-purple px-6 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white shadow-[0_0_24px_-4px_var(--pink)] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save targets"}
        </button>
        {state && <span className={cn("text-sm", state.ok ? "text-mint" : "text-red")}>{state.message}</span>}
      </div>
    </form>
  );
}
