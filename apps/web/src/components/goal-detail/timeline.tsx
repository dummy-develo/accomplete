import { cn } from "@/lib/utils";

type Goal = any;
type Milestone = any;
type Checkin = any;

type TimelineProps = {
  goal: Goal;
  milestones: Milestone[];
  checkins: Checkin[];
};

// One row in the rendered timeline. The visual kind dictates the marker
// shape; the temporal kind decides whether the *line below* this row is
// solid (past) or dashed (today/future).
type Row = {
  key: string;
  date: Date | null;
  label: string;
  detail?: string;
  marker:
    | "checkin"
    | "milestone-reached"
    | "today"
    | "milestone-future"
    | "goal-start"
    | "goal-end";
  temporal: "past" | "today" | "future";
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function GoalDetailTimeline({ goal, milestones, checkins }: TimelineProps) {
  const rows = buildRows(goal, milestones, checkins);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        no check-ins yet. check in once to see this fill up.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        // Line below a row is solid only when the row itself is in the past;
        // anything from today onwards becomes dashed.
        const lineSolid = row.temporal === "past";
        return (
          <li key={row.key} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative w-3 shrink-0">
              <TimelineMarker kind={row.marker} />
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 top-4 bottom-[-1.5rem] w-px",
                    lineSolid
                      ? "bg-border"
                      : "border-l border-dashed border-border",
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-[-2px]">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-sm text-foreground">{row.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDate(row.date)}
                </span>
              </div>
              {row.detail && (
                <p className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {row.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function buildRows(goal: Goal, milestones: Milestone[], checkins: Checkin[]): Row[] {
  const now = new Date();
  const past: Row[] = [];
  const future: Row[] = [];

  for (const c of checkins) {
    const date = c.created_at ? new Date(c.created_at) : null;
    past.push({
      key: `checkin-${c.id ?? c.created_at}`,
      date,
      label: "check-in",
      detail: buildCheckinDetail(c, goal.benchmark_name),
      marker: "checkin",
      temporal: "past",
    });
  }

  for (const m of milestones) {
    if (m.reached_at) {
      past.push({
        key: `ms-r-${m.id ?? m.order_index}`,
        date: new Date(m.reached_at),
        label: `milestone ${m.order_index ?? ""}`.trim() + " reached",
        detail: m.message ? `"${m.message}"` : undefined,
        marker: "milestone-reached",
        temporal: "past",
      });
    } else {
      future.push({
        key: `ms-p-${m.id ?? m.order_index}`,
        date: m.target_date ? new Date(m.target_date) : null,
        label: `milestone ${m.order_index ?? ""}`.trim(),
        detail: m.message ? `"${m.message}"` : undefined,
        marker: "milestone-future",
        temporal: "future",
      });
    }
  }

  const byTime = (a: Row, b: Row) =>
    (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
  past.sort(byTime);
  future.sort(byTime);

  // "Goal created" — always the first row. Frames the timeline so the user
  // sees where the journey started before any check-ins or milestones.
  const rows: Row[] = [
    {
      key: "goal-start",
      date: goal.created_at ? new Date(goal.created_at) : null,
      label: "goal created",
      marker: "goal-start",
      temporal: "past",
    },
    ...past,
  ];

  // Insert "today" marker only for active goals — for completed/dropped
  // goals, "you are here" doesn't apply.
  if (goal.status === "active") {
    rows.push({
      key: "today",
      date: now,
      label: "today",
      marker: "today",
      temporal: "today",
    });
  }

  rows.push(...future);

  // Goal end marker — always last.
  rows.push({
    key: "goal-end",
    date: goal.target_completion_at ? new Date(goal.target_completion_at) : null,
    label: goal.status === "completed" ? "goal completed" : "goal end",
    marker: "goal-end",
    temporal: goal.status === "completed" ? "past" : "future",
  });

  return rows;
}

function buildCheckinDetail(checkin: Checkin, benchmarkName: string | null): string | undefined {
  const parts: string[] = [];
  if (checkin.metric_value != null) {
    parts.push(`${benchmarkName ?? "value"}: ${checkin.metric_value}`);
  }
  if (checkin.notes) {
    parts.push(checkin.notes);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function TimelineMarker({ kind }: { kind: Row["marker"] }) {
  if (kind === "today") {
    // Donut: outline ring with the background bleeding through the center.
    return (
      <span className="block size-3 rounded-full border-2 border-primary bg-background" />
    );
  }
  if (kind === "milestone-future") {
    return <span className="block size-2.5 bg-primary/40 rotate-45" />;
  }
  if (kind === "milestone-reached") {
    return <span className="block size-3 rounded-full bg-primary" />;
  }
  if (kind === "goal-start" || kind === "goal-end") {
    // Filled square — used to "bracket" the timeline at both ends so the
    // start and end of the journey have visually equal weight.
    return <span className="block size-3 bg-primary" />;
  }
  // checkin
  return <span className="block size-2 rounded-full bg-primary mx-0.5 my-0.5" />;
}
