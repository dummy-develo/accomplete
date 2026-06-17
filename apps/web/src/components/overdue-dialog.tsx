"use client";

import { useEffect, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/client-date";

type Goal = any;

type OverdueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  // Called after a successful extend or complete so the parent can refetch.
  onSuccess?: () => void;
};

// Shown for an overdue goal (active, but target date passed). The goal is
// frozen — check-ins are blocked server-side — so the only ways forward are to
// push the deadline out or to call it done. Both actions hit existing
// endpoints: PATCH /api/goals/[id] (extend, runs reconcileMilestones) and
// POST /api/goals/[id]/complete (5x bonus).
export function OverdueDialog({
  open,
  onOpenChange,
  goal,
  onSuccess,
}: OverdueDialogProps) {
  const [newDate, setNewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewDate("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, goal?.id]);

  if (!goal) return null;

  // Completion bonus mirrors the goal-detail copy: 5x the points earned so far.
  const completionBonus =
    5 * ((goal.score_checkin ?? 0) + (goal.score_milestone ?? 0));

  // The extend date must be strictly in the future — same rule the edit page
  // enforces. min on the input is tomorrow so the picker can't offer today.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  async function handleExtend() {
    if (!goal) return;
    if (!newDate) {
      setError("pick a new target date.");
      return;
    }
    if (new Date(newDate) <= new Date()) {
      setError("the new target date must be in the future.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_completion_at: new Date(newDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error ?? "failed to extend");
        return;
      }
      onSuccess?.();
      onOpenChange(false);
    } catch {
      setError("something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    if (!goal) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error ?? "failed to complete");
        return;
      }
      onSuccess?.();
      onOpenChange(false);
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
          <DialogTitle className="flex items-center gap-2">
            <WarningCircle
              size={18}
              weight="fill"
              style={{ color: "var(--status-overdue)" }}
            />
            {goal.goal_name}
          </DialogTitle>
          <DialogDescription>
            Target date passed
            {goal.target_completion_at
              ? ` on ${formatDate(goal.target_completion_at)}`
              : ""}
            . This goal is frozen until you extend or complete it — check-ins
            are paused.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">
              Extend to a new target date
            </label>
            <div className="flex gap-2">
              <Input
                type="date"
                min={tomorrow}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleExtend}
                disabled={submitting}
              >
                Extend
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Done with it? Completing earns a 5× bonus of{" "}
              <strong>{completionBonus.toLocaleString()} points</strong>. This is
              irreversible.
            </p>
            <Button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? "working..." : "Mark as complete"}
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
