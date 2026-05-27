import { CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type Goal = any;

type TodayRightRailProps = {
  pending: Goal[];
  done: Goal[];
  hasGoals: boolean;
  todayMonoDate: string;
  // Click handler for the per-goal "Check in" button on a pending card.
  // The parent opens the CheckInDialog with this goal.
  onCheckIn: (goal: Goal) => void;
};

export function TodayRightRail({
  pending,
  done,
  hasGoals,
  todayMonoDate,
  onCheckIn,
}: TodayRightRailProps) {
  return (
    <div>
      <Header todayMonoDate={todayMonoDate} />

      {!hasGoals ? (
        <NewUserPrompt />
      ) : pending.length === 0 ? (
        <>
          <AllDoneMessage />
          {done.length > 0 && <DoneSection items={done} />}
        </>
      ) : (
        <>
          <PendingSection items={pending} onCheckIn={onCheckIn} />
          {done.length > 0 && <DoneSection items={done} />}
        </>
      )}
    </div>
  );
}

function Header({ todayMonoDate }: { todayMonoDate: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold">Today</h2>
      <p className="font-mono text-xs text-muted-foreground mt-1">
        {todayMonoDate}
      </p>
    </div>
  );
}

function NewUserPrompt() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>create your first goal to start checking in.</p>
    </div>
  );
}

function AllDoneMessage() {
  return (
    <div>
      <p className="text-sm">all done for today.</p>
      <p className="text-xs text-muted-foreground mt-2">
        quiet work compounds. see you tomorrow.
      </p>
    </div>
  );
}

function PendingSection({
  items,
  onCheckIn,
}: {
  items: Goal[];
  onCheckIn: (goal: Goal) => void;
}) {
  return (
    <section>
      <SectionHeader label="Pending" count={items.length} />
      <div className="flex flex-col gap-2">
        {items.map((goal) => (
          <PendingCard key={goal.id} goal={goal} onCheckIn={onCheckIn} />
        ))}
      </div>
    </section>
  );
}

function PendingCard({
  goal,
  onCheckIn,
}: {
  goal: Goal;
  onCheckIn: (goal: Goal) => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 flex flex-col gap-2 bg-card surface-gloss">
      <div className="text-sm truncate text-foreground">{goal.goal_name}</div>
      <Button size="sm" className="w-full" onClick={() => onCheckIn(goal)}>
        Check in
      </Button>
    </div>
  );
}

function DoneSection({ items }: { items: Goal[] }) {
  return (
    <section className="mt-8">
      <SectionHeader label="Done" count={items.length} />
      <ul className="flex flex-col gap-2">
        {items.map((goal) => (
          <li
            key={goal.id}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            <CheckCircle
              size={14}
              weight="fill"
              className="text-primary shrink-0"
            />
            <span className="truncate">{goal.goal_name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <span className="font-mono text-sm text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}
