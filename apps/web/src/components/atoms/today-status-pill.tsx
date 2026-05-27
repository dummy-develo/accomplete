import { Badge } from "@/components/ui/badge";

type TodayStatusPillProps = {
  state: "checked-in" | "pending";
};

export function TodayStatusPill({ state }: TodayStatusPillProps) {
  // Compressed, uppercase typography: the pill is a label, not a button —
  // tracking-wide + uppercase keeps it from competing with the goal name
  // beside it while still reading at a glance.
  const baseClasses = "font-normal text-xs uppercase tracking-wide px-2 py-0.5";
  if (state === "checked-in") {
    return (
      <Badge variant="secondary" className={baseClasses}>
        Checked in
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`${baseClasses} text-muted-foreground`}>
      Pending
    </Badge>
  );
}
