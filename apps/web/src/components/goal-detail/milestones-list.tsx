import { formatDate } from "@/lib/client-date";

type Milestone = any;

type MilestonesListProps = {
  milestones: Milestone[];
};

export function MilestonesList({ milestones }: MilestonesListProps) {
  if (milestones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        no milestones set for this goal.
      </p>
    );
  }

  const sorted = [...milestones].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );

  return (
    <ul className="flex flex-col gap-4">
      {sorted.map((m) => (
        <MilestoneRow key={m.id ?? m.order_index} milestone={m} />
      ))}
    </ul>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const reached = !!milestone.reached_at;
  const dateLabel = reached
    ? `reached on ${formatDate(milestone.reached_at)}`
    : `target: ${formatDate(milestone.target_date)}`;

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-3">
        <span className="text-sm text-foreground">
          milestone {milestone.order_index ?? ""}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {dateLabel}
        </span>
      </div>
      {milestone.message && (
        <p className="text-xs italic text-muted-foreground break-words whitespace-pre-wrap">
          &ldquo;{milestone.message}&rdquo;
        </p>
      )}
    </li>
  );
}
