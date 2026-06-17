// apps/web/src/app/goals/[id]/page.tsx
//
// Goal detail page — deep view of a single goal.
// Layout: sidebar + main (no right rail).
"use client";

import { DotsThree, WarningCircle } from "@phosphor-icons/react";
import { BackLink } from "@/components/atoms/back-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeroStat } from "@/components/atoms/hero-stat";
import { CheckInDialog } from "@/components/check-in-dialog";
import { OverdueDialog } from "@/components/overdue-dialog";
import { isGoalOverdue, formatDate } from "@/lib/client-date";
import { GoalDetailTimeline } from "@/components/goal-detail/timeline";
import { MilestonesList } from "@/components/goal-detail/milestones-list";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Goal = any;
type Milestone = any;
type Checkin = any;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(target: string | null): number {
  if (!target) return 0;
  const diff = new Date(target).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

export default function GoalDetail() {
  const params = useParams();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  // Owner's stored timezone — needed so the check-in dialog's "already
  // checked in today" computation matches the server's notion of today.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);

  const loadGoal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalRes, meRes] = await Promise.all([
        fetch(`/api/goals/${goalId}`),
        fetch("/api/profile/me"),
      ]);
      const goalJson = await goalRes.json();
      if (!goalRes.ok || !goalJson.goal) {
        setError("goal not found");
        return;
      }
      setGoal(goalJson.goal);
      if (meRes.ok) {
        const meJson = await meRes.json();
        setTimezone(meJson.profile?.timezone ?? null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch(`/api/milestones/${goalId}`),
        fetch(`/api/checkins/${goalId}`),
      ]);
      const mJson = await mRes.json();
      const cJson = await cRes.json();
      setMilestones(mJson.milestones ?? []);
      setCheckins(cJson.checkins ?? []);
    } catch {
      setMilestones([]);
      setCheckins([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    loadGoal();
    loadTimeline();

    // bfcache: refresh on back-forward cache restore so the page never
    // shows stale check-in / streak state.
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        loadGoal();
        loadTimeline();
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [loadGoal, loadTimeline]);

  return (
    <AppShell>
      <BackLink />

      {loading && (
        <p className="mt-12 text-sm text-muted-foreground">loading...</p>
      )}
      {error && <NotFound message={error} />}

      {!loading && !error && goal && (
        <>
          <GoalHeader
            goal={goal}
            goalId={goalId}
            reloadGoal={loadGoal}
            overdue={isGoalOverdue(goal, timezone)}
          />
          <StatsRow
            goal={goal}
            checkinCount={checkins.length}
            overdue={isGoalOverdue(goal, timezone)}
          />

          {goal.status === "active" &&
            (isGoalOverdue(goal, timezone) ? (
              <OverdueBanner
                goal={goal}
                onResolve={() => setOverdueOpen(true)}
              />
            ) : (
              <section className="mt-10">
                <Button size="lg" onClick={() => setCheckInOpen(true)}>
                  Check in for today
                </Button>
              </section>
            ))}

          <section className="mt-14">
            <SectionHeader>Timeline</SectionHeader>
            {timelineLoading ? (
              <p className="text-sm text-muted-foreground">
                loading timeline...
              </p>
            ) : (
              <GoalDetailTimeline
                goal={goal}
                milestones={milestones}
                checkins={checkins}
              />
            )}
          </section>

          <section className="mt-14">
            <SectionHeader>Milestones</SectionHeader>
            {timelineLoading ? (
              <p className="text-sm text-muted-foreground">
                loading milestones...
              </p>
            ) : (
              <MilestonesList milestones={milestones} />
            )}
          </section>
        </>
      )}

      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        goal={goal}
        timezone={timezone}
        onSuccess={() => {
          loadGoal();
          loadTimeline();
        }}
      />

      <OverdueDialog
        open={overdueOpen}
        onOpenChange={setOverdueOpen}
        goal={goal}
        onSuccess={() => {
          loadGoal();
          loadTimeline();
        }}
      />
    </AppShell>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold mb-5">{children}</h2>;
}

// Replaces the check-in button when an active goal's deadline has passed. The
// goal is frozen (check-ins are blocked server-side); the only ways forward
// are to extend the deadline or complete the goal, both via OverdueDialog.
function OverdueBanner({
  goal,
  onResolve,
}: {
  goal: Goal;
  onResolve: () => void;
}) {
  const passedOn = goal.target_completion_at
    ? formatDate(goal.target_completion_at)
    : null;

  return (
    <section className="mt-10">
      <div
        className="rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--status-overdue)" }}
      >
        <div className="flex items-start gap-3">
          <WarningCircle
            size={20}
            weight="fill"
            className="shrink-0 mt-0.5"
            style={{ color: "var(--status-overdue)" }}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              Target date passed{passedOn ? ` on ${passedOn}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check-ins are paused. Extend the deadline or complete the goal to
              continue.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onResolve} className="shrink-0">
          Extend or complete
        </Button>
      </div>
    </section>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <p className="text-sm">{message}</p>
      <p className="text-xs text-muted-foreground">
        the goal you&apos;re looking for doesn&apos;t exist or isn&apos;t
        accessible.
      </p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/">Back to Today</Link>
      </Button>
    </div>
  );
}

function GoalHeader({
  goal,
  goalId,
  reloadGoal,
  overdue,
}: {
  goal: Goal;
  goalId: string;
  reloadGoal: () => Promise<void>;
  overdue: boolean;
}) {
  const category: string | null = goal.category ?? null;
  const target =
    goal.benchmark_target_value != null && goal.benchmark_name
      ? `${goal.benchmark_target_value} ${goal.benchmark_name}`
      : null;

  return (
    <header className="mt-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {category && (
              <Badge variant="outline" className="font-normal">
                {category}
              </Badge>
            )}
            <StatusPill status={goal.status} overdue={overdue} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground break-words">
            {goal.goal_name}
          </h1>
          {target && (
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              target {target}
            </p>
          )}
          {goal.goal_description && (
            <p className="mt-2 text-sm text-muted-foreground break-words whitespace-pre-wrap">
              {goal.goal_description}
            </p>
          )}
        </div>
        {goal.status === "active" && (
          <GoalActions goalId={goalId} goal={goal} reloadGoal={reloadGoal} />
        )}
      </div>
    </header>
  );
}

function StatusPill({
  status,
  overdue,
}: {
  status: string;
  overdue?: boolean;
}) {
  if (status === "completed") {
    return (
      <Badge variant="secondary" className="font-normal">
        completed
      </Badge>
    );
  }
  if (status === "dropped") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        dropped
      </Badge>
    );
  }
  if (overdue) {
    return (
      <Badge
        variant="outline"
        className="font-normal text-destructive border-destructive/50"
      >
        overdue
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal">
      active
    </Badge>
  );
}

function StatsRow({
  goal,
  checkinCount,
  overdue,
}: {
  goal: Goal;
  checkinCount: number;
  overdue: boolean;
}) {
  const points =
    (goal.score_checkin ?? 0) +
    (goal.score_milestone ?? 0) +
    (goal.score_completion ?? 0);
  const currentStreak = goal.current_streak ?? 0;
  const bestStreak = goal.best_streak ?? 0;

  // "Days left" only makes sense on an active, on-time goal. Overdue shows
  // "overdue"; completed/dropped show a dash — the deadline is no longer
  // relevant.
  const daysLeft = overdue
    ? "overdue"
    : goal.status === "active"
      ? `${daysUntil(goal.target_completion_at)}d`
      : "—";

  return (
    <section className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-8">
      <HeroStat label="Check-ins" value={checkinCount} />
      <HeroStat label="Current streak" value={currentStreak} />
      <HeroStat label="Best streak" value={bestStreak} />
      <HeroStat label="Points" value={points.toLocaleString()} />
      <HeroStat label="Days left" value={daysLeft} />
    </section>
  );
}

function GoalActions({
  goalId,
  goal,
  reloadGoal,
}: {
  goalId: string;
  goal: Goal;
  reloadGoal: () => Promise<void>;
}) {
  const router = useRouter();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/complete`, {
        method: "POST",
      });
      if (res.ok) await reloadGoal();
    } finally {
      setSubmitting(false);
      setCompleteOpen(false);
    }
  }

  async function handleDrop() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/drop`, { method: "POST" });
      if (res.ok) await reloadGoal();
    } finally {
      setSubmitting(false);
      setDropOpen(false);
    }
  }

  const totalGoalScore =
    (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const completionBonus = 5 * totalGoalScore;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Goal actions"
          >
            <DotsThree size={16} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => router.push(`/goals/${goalId}/edit`)}>
            Edit goal
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/goals/${goalId}/edit?tab=privacy`)}
          >
            Edit privacy
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
            Mark as complete
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDropOpen(true)}
          >
            Drop goal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>complete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              this is irreversible. you&apos;ll earn a 5× completion bonus of{" "}
              <strong>{completionBonus.toLocaleString()} points</strong> on top
              of your current score. no more check-ins after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={submitting}>
              {submitting ? "completing..." : "complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dropOpen} onOpenChange={setDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>drop this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              this is irreversible. your streak will reset and you won&apos;t
              earn the completion bonus. points already earned are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDrop}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "dropping..." : "drop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

