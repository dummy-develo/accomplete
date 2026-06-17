import { formatDate } from "@/lib/client-date";

type ProgressWithMarkerProps = {
  start: Date;
  end: Date;
  now?: Date;
};

// "14 Sep" — day + short month, no year. Cards are tight; the year is usually
// inferable from context and adds visual weight without info.
function formatShortDate(date: Date): string {
  return formatDate(date, { withYear: false });
}

export function ProgressWithMarker({
  start,
  end,
  now = new Date(),
}: ProgressWithMarkerProps) {
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const pct =
    total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-1 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/40"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full bg-primary ring-2 ring-background"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
        <span>{formatShortDate(start)}</span>
        <span>{formatShortDate(end)}</span>
      </div>
    </div>
  );
}
