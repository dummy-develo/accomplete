import { Badge } from "@/components/ui/badge";

type TodayStatusPillProps = {
  state: "checked-in" | "pending";
};

export function TodayStatusPill({ state }: TodayStatusPillProps) {
  // Compressed, uppercase typography: the pill is a label, not a button —
  // tracking-wide + uppercase keeps it from competing with the goal name
  // beside it while still reading at a glance. The colored dot is the only
  // chromatic accent and carries the semantic — text stays muted.
  const baseClasses =
    "font-normal text-xs uppercase tracking-wide px-2 py-0.5 inline-flex items-center gap-1.5";
  const isDone = state === "checked-in";
  const dotColor = isDone
    ? "var(--status-success)"
    : "var(--status-pending)";

  return (
    <Badge
      variant={isDone ? "secondary" : "outline"}
      className={`${baseClasses}${isDone ? "" : " text-muted-foreground"}`}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      {isDone ? "Checked in" : "Pending"}
    </Badge>
  );
}
