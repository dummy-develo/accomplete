"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Trophy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FIELD_LIMITS,
  NUMERIC_BOUNDS,
  clampToBounds,
} from "@/lib/constants";
import { todayInTimezone, formatMonoDate } from "@/lib/client-date";

type Goal = any;

type CheckInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  // Owner's stored timezone — needed so "already checked in today" matches
  // the server's notion of today (which is also derived from this zone).
  // Pass null if not yet loaded; the helper falls back to UTC.
  timezone?: string | null;
  // Called once the check-in API returns success. Parent typically refetches
  // its data here so streaks / check-in pills update.
  onSuccess?: () => void;
};

export function CheckInDialog({
  open,
  onOpenChange,
  goal,
  timezone,
  onSuccess,
}: CheckInDialogProps) {
  const [metricValue, setMetricValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  // Milestones unlocked by this check-in (server-detected, can be 0..n).
  // Drives the celebration variant of the success state.
  const [reachedMilestones, setReachedMilestones] = useState<any[]>([]);

  // Reset form state whenever the dialog opens for a (possibly different)
  // goal. Without this, switching from goal A to goal B carries over the
  // previous value/notes.
  useEffect(() => {
    if (open) {
      setMetricValue("");
      setNotes("");
      setError(null);
      setSucceeded(false);
      setSubmitting(false);
      setReachedMilestones([]);
    }
  }, [open, goal?.id]);

  if (!goal) return null;

  const today = todayInTimezone(timezone);
  const alreadyCheckedInToday = goal.last_checkin_date === today;
  const nextStreak = (goal.current_streak ?? 0) + 1;
  const benchmarkName: string | null = goal.benchmark_name ?? null;
  // Just the number — the unit (benchmark name) is already rendered as the
  // field label on the left, so repeating it on the target chip on the
  // right reads as "hours worked … target 4 hours worked". Number alone
  // keeps the line as "hours worked … target 4".
  const targetValue =
    goal.benchmark_target_value != null
      ? String(goal.benchmark_target_value)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkins/${goal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_value: metricValue ? Number(clampToBounds(metricValue)) : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error ?? "failed to check in");
        return;
      }
      const okJson = await res.json().catch(() => ({}));
      const unlocked = Array.isArray(okJson.reachedMilestones)
        ? okJson.reachedMilestones
        : [];
      setReachedMilestones(unlocked);
      setSucceeded(true);
      onSuccess?.();
      // Auto-close timing: 1.5s on a plain check-in, 3s when a milestone
      // unlocked so the celebration has room to breathe.
      const closeDelay = unlocked.length > 0 ? 3000 : 1500;
      window.setTimeout(() => onOpenChange(false), closeDelay);
    } catch {
      setError("something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal.goal_name}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{formatMonoDate()}</span>
          </DialogDescription>
        </DialogHeader>

        {succeeded ? (
          reachedMilestones.length > 0 ? (
            <MilestoneUnlockState milestones={reachedMilestones} />
          ) : (
            <SuccessState
              alreadyCheckedInToday={alreadyCheckedInToday}
              nextStreak={nextStreak}
            />
          )
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-xs text-muted-foreground">
                  {benchmarkName ?? "value"}
                </label>
                {targetValue && (
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    target {targetValue}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                min={NUMERIC_BOUNDS.min}
                max={NUMERIC_BOUNDS.max}
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                onBlur={(e) => setMetricValue(clampToBounds(e.target.value))}
                placeholder="0"
                autoFocus
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={FIELD_LIMITS.checkinNotes}
                placeholder="anything to remember about today?"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {alreadyCheckedInToday
                ? "already checked in today — this won't add points."
                : `this will be your ${nextStreak}-day streak.`}
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "saving..." : "Check in"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessState({
  alreadyCheckedInToday,
  nextStreak,
}: {
  alreadyCheckedInToday: boolean;
  nextStreak: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <CheckCircle size={28} weight="fill" className="text-primary" />
      <p className="text-sm">Checked in</p>
      <p className="text-xs text-muted-foreground">
        {alreadyCheckedInToday
          ? "saved — no streak change."
          : `streak: ${nextStreak} days.`}
      </p>
    </div>
  );
}

// Quiet celebration shown when a check-in unlocks one or more milestones.
// Replaces the regular streak summary in the dialog's success state.
function MilestoneUnlockState({ milestones }: { milestones: any[] }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Trophy size={28} weight="fill" className="text-primary" />
      <p className="text-sm">Milestone reached</p>
      <ul className="flex flex-col gap-3 w-full">
        {milestones.map((m) => (
          <li
            key={m.id ?? m.order_index}
            className="flex flex-col gap-1 text-center"
          >
            <p className="text-xs text-foreground">
              milestone {m.order_index ?? ""}
              {typeof m.points_earned === "number" && m.points_earned > 0 && (
                <span className="ml-2 font-mono text-muted-foreground">
                  +{m.points_earned} pts
                </span>
              )}
            </p>
            {m.message && (
              <p className="text-xs italic text-muted-foreground break-words whitespace-pre-wrap">
                &ldquo;{m.message}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
