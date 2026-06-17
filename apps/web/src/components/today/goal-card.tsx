import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TodayStatusPill } from "@/components/atoms/today-status-pill";
import { ProgressWithMarker } from "@/components/atoms/progress-with-marker";
import { cn } from "@/lib/utils";

// `any` until packages/shared defines Goal — matches the rest of the codebase.
type Goal = any;

type TodayGoalCardProps = {
  goal: Goal;
  checkedInToday: boolean;
  overdue?: boolean;
};

export function TodayGoalCard({
  goal,
  checkedInToday,
  overdue = false,
}: TodayGoalCardProps) {
  const now = new Date();
  const start = new Date(goal.created_at);
  const end = goal.target_completion_at
    ? new Date(goal.target_completion_at)
    : now;

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / msPerDay),
  );
  const points = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const streak = goal.current_streak ?? 0;
  const category: string | null = goal.category ?? null;
  const target =
    goal.benchmark_target_value != null && goal.benchmark_name
      ? `${goal.benchmark_target_value} ${goal.benchmark_name}`
      : null;

  return (
    <Link href={`/goals/${goal.id}`} className="block group">
      <Card
        className={cn(
          // ring-0 + border-border replaces shadcn Card's default ring with
          // an explicit border for the elevated-surface look. surface-gloss
          // adds the top-edge highlight, soft drop shadow, and faint top-to-
          // bottom sheen that give the block its premium glassy feel.
          "ring-0 border border-border rounded-xl surface-gloss",
          "transition-colors group-hover:bg-card/70 h-full",
        )}
      >
        <CardContent className="p-5 flex flex-col gap-4 h-full">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {category && (
                <div className="font-mono text-xs text-muted-foreground tracking-wide mb-1.5 truncate">
                  {category}
                </div>
              )}
              <h3 className="text-base font-semibold truncate text-foreground">
                {goal.goal_name}
              </h3>
            </div>
            <TodayStatusPill
              state={
                overdue ? "overdue" : checkedInToday ? "checked-in" : "pending"
              }
            />
          </div>

          <ProgressWithMarker start={start} end={end} now={now} />

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs mt-auto">
            <CardStat label="streak" value={streak} />
            <CardStat label="points" value={points} />
            {target && <CardStat label="target" value={target} />}
            {overdue ? (
              <CardStat
                label="left"
                value="overdue"
                valueClassName="text-destructive"
              />
            ) : (
              <CardStat label="left" value={`${daysLeft}d`} />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CardStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
