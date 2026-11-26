import { addDays, weekStart, fmtShort } from "@/lib/dates";

/** GitHub-style calendar: one column per week, cell intensity = working sets that day. */
export function TrainingHeatmap({ days }: { days: { date: string; sets: number; steps: number | null }[] }) {
  if (!days.length) return null;
  const first = weekStart(days[0].date);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const last = days.at(-1)!.date;
  const weeks: string[][] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  const max = Math.max(1, ...days.map((d) => d.sets));

  const color = (sets: number) => {
    if (!sets) return "rgb(255 255 255 / 0.05)";
    const t = 0.25 + 0.75 * (sets / max);
    return `color-mix(in srgb, var(--pink) ${Math.round(t * 100)}%, var(--purple))`;
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-[3px]">
        {weeks.map((wk) => (
          <div key={wk[0]} className="flex flex-col gap-[3px]">
            {wk.map((d) => {
              const day = byDate.get(d);
              const sets = day?.sets ?? 0;
              const inRange = d >= days[0].date && d <= last;
              return (
                <div
                  key={d}
                  title={inRange ? `${fmtShort(d)}: ${sets ? `${sets} working sets` : "rest"}${day?.steps != null ? ` · ${day.steps.toLocaleString()} steps` : ""}` : undefined}
                  className="size-3 rounded-[3px]"
                  style={{ background: inRange ? color(sets) : "transparent", boxShadow: sets ? `0 0 ${4 + 6 * (sets / max)}px rgb(255 42 109 / ${0.25 + 0.4 * (sets / max)})` : undefined }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
        less
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t} className="size-3 rounded-[3px]" style={{ background: color(Math.round(t * max)) }} />)}
        more
      </div>
    </div>
  );
}
