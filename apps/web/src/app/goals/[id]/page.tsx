// apps/web/src/app/goals/[id]/page.tsx
//
// Goal detail page — read-only view of a single goal.
// Layer 1: header, stats, meta. Check-in history, milestones, and
// drop/complete actions come in later layers.
"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Goal = any;
type Milestone = any;
type Checkin = any;

export default function GoalDetail() {
  const params = useParams();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeline data has its own loading state so the page header/stats can
  // render immediately while the milestones + checkins calls are in flight.
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  const loadGoal = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/goals/${goalId}`);
      const json = await res.json();
      // The API returns { goal } on success. A missing goal (wrong id,
      // not owned by this user, deleted) comes back as an error payload
      // or a null goal — treat both as "not found" on this page.
      if (!res.ok || !json.goal) {
        setError("goal not found");
        return;
      }
      setGoal(json.goal);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  // Milestones + checkins fetched together so the timeline has a single
  // loading state. Failures here are silent — an empty timeline is a
  // better failure mode than blocking the rest of the page.
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

    // Same bfcache safety net as the home page — refetch when the
    // browser restores the page from its back-forward cache.
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        loadGoal();
        loadTimeline();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadGoal, loadTimeline]);

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-6">
      <TopBar />

      {loading && (
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      )}

      {error && <NotFound message={error} />}

      {!loading && !error && goal && (
        <>
          <GoalHeader goal={goal} goalId={goalId} loadGoal={loadGoal} />
          <StatsBar goal={goal} />
          <MetaInfo goal={goal} />
          {goal.status === "active" && (
            <CheckInForm
              goalId={goalId}
              benchmarkName={goal.benchmark_name}
              onCheckinCreated={() => { loadGoal(); loadTimeline(); }}
            />
          )}
          <TimelineSection
            goal={goal}
            milestones={milestones}
            checkins={checkins}
            loading={timelineLoading}
          />
        </>
      )}
    </main>
  );
}

function TopBar() {
  return (
    <nav className="flex items-center pb-4 border-b">
      <Link
        href="/"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← back to home
      </Link>
    </nav>
  );
}

// Inline fallback shown when the goal can't be loaded. Keeping this in
// the same file on purpose — simple enough that a dedicated not-found.tsx
// would be overkill right now.
function NotFound({ message }: { message: string }) {
  return (
    <Card className="mt-10">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          the goal you're looking for doesn't exist or isn't accessible.
        </p>
        <Link href="/" className="mt-2 text-xs underline underline-offset-4">
          back to home
        </Link>
      </CardContent>
    </Card>
  );
}

function GoalHeader({
  goal,
  goalId,
  loadGoal,
}: {
  goal: Goal;
  goalId: string;
  loadGoal: () => Promise<void>;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {goal.goal_name}
            </h1>
            {goal.goal_type && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {goal.goal_type}
              </span>
            )}
          </div>
          {goal.goal_description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {goal.goal_description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={goal.status} />
          {goal.status === "active" && (
            <GoalActions goalId={goalId} goal={goal} loadGoal={loadGoal} />
          )}
        </div>
      </div>
    </section>
  );
}

// Goal actions dropdown — complete, drop, or navigate to edit pages.
// Only rendered for active goals. Each destructive action opens a
// confirmation dialog before hitting the API.
function GoalActions({
  goalId,
  goal,
  loadGoal,
}: {
  goalId: string;
  goal: Goal;
  loadGoal: () => Promise<void>;
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
      if (res.ok) await loadGoal();
    } finally {
      setSubmitting(false);
      setCompleteOpen(false);
    }
  }

  async function handleDrop() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/drop`, {
        method: "POST",
      });
      if (res.ok) await loadGoal();
    } finally {
      setSubmitting(false);
      setDropOpen(false);
    }
  }

  // Pre-compute the completion bonus for the dialog description
  const totalGoalScore =
    (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const completionBonus = 5 * totalGoalScore;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-center h-7 w-7 rounded-md border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            aria-label="Goal actions"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/goals/${goalId}/edit`)}>
            edit goal
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/goals/${goalId}/edit?tab=privacy`)}
          >
            edit privacy
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
            mark as complete
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-500 focus:text-red-500"
            onClick={() => setDropOpen(true)}
          >
            drop goal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete goal confirmation */}
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

      {/* Drop goal confirmation */}
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
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {submitting ? "dropping..." : "drop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Monochrome status badge — keeps the theme consistent by using fill/weight
// instead of color. Completed inverts (filled), dropped dims, active is neutral.
function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "bg-foreground text-background border-foreground"
      : status === "dropped"
      ? "border-muted-foreground text-muted-foreground"
      : "border-foreground text-foreground";
  return (
    <span
      className={`text-[10px] uppercase tracking-widest border px-2 py-1 shrink-0 ${classes}`}
    >
      {status}
    </span>
  );
}

function StatsBar({ goal }: { goal: Goal }) {
  // Total goal score is check-in points + milestone bonuses + completion bonus.
  const score =
    (goal.score_checkin ?? 0) +
    (goal.score_milestone ?? 0) +
    (goal.score_completion ?? 0);
  const currentStreak = goal.current_streak ?? 0;
  const bestStreak = goal.best_streak ?? 0;

  return (
    <div className="grid grid-cols-3 gap-3 mt-8">
      <StatCell label="score" value={score} />
      <StatCell label="current streak" value={currentStreak} />
      <StatCell label="best streak" value={bestStreak} />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-1 py-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-4xl font-bold tabular-nums leading-none">
          {value.toLocaleString()}
        </span>
      </CardContent>
    </Card>
  );
}

function MetaInfo({ goal }: { goal: Goal }) {
  const deadline = goal.target_completion_at
    ? new Date(goal.target_completion_at).toLocaleDateString()
    : "—";

  const target = `${goal.benchmark_target_value ?? "—"} ${
    goal.benchmark_name ?? ""
  }`.trim();

  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        details
      </h2>
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
          <MetaItem label="target" value={target} />
          <MetaItem label="frequency" value={goal.checkin_frequency ?? "—"} />
          <MetaItem label="deadline" value={deadline} />
        </CardContent>
      </Card>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Check-in form
// ----------------------------------------------------------------------

function CheckInForm({
  goalId,
  benchmarkName,
  onCheckinCreated,
}: {
  goalId: string;
  benchmarkName: string | null;
  onCheckinCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [metricValue, setMetricValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/checkins/${goalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_value: metricValue ? Number(metricValue) : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "failed to check in");
        return;
      }

      // Reset form, close it, and refresh the timeline
      setMetricValue("");
      setNotes("");
      setOpen(false);
      onCheckinCreated();
    } catch {
      setError("something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border border-dashed border-muted-foreground/40 rounded-lg py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          + check in
        </button>
      ) : (
        <Card>
          <CardContent className="py-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {benchmarkName ?? "value"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={metricValue}
                  onChange={(e) => setMetricValue(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="optional"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "saving..." : "submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------
// Timeline
// ----------------------------------------------------------------------

type TimelineItem = {
  kind: "checkin" | "milestone-reached" | "milestone-pending" | "goal-end";
  timestamp: string | null;
  data: any;
};

function TimelineSection({
  goal,
  milestones,
  checkins,
  loading,
}: {
  goal: Goal;
  milestones: Milestone[];
  checkins: Checkin[];
  loading: boolean;
}) {
  // Collapsible "dropdown" — default open so the user sees everything on
  // first load. State is section-local because toggling has no side effects.
  const [expanded, setExpanded] = useState(true);

  // Build two sorted buckets out of the raw arrays:
  //   past     — check-ins + reached milestones, oldest → newest
  //   upcoming — pending milestones, earliest → latest
  // The goal-end marker is appended separately after upcoming so it's
  // always the very last row.
  const { past, upcoming } = buildTimeline(checkins, milestones);

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>timeline</span>
      </button>

      {expanded && (
        <Card>
          <CardContent className="py-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                loading timeline...
              </p>
            ) : past.length === 0 &&
              upcoming.length === 0 &&
              !goal.target_completion_at ? (
              <p className="text-sm text-muted-foreground">nothing yet.</p>
            ) : (
              <ol className="flex flex-col">
                {past.map((item, i) => (
                  <TimelineRow key={`past-${i}`} item={item} dimmed={false} benchmarkName={goal.benchmark_name} />
                ))}
                {upcoming.map((item, i) => (
                  <TimelineRow key={`up-${i}`} item={item} dimmed={true} benchmarkName={goal.benchmark_name} />
                ))}
                {/* Goal end is always last. Dimmed unless the goal is
                    actually completed — an active or dropped goal hasn't
                    reached its finish line yet. */}
                <TimelineRow
                  item={{
                    kind: "goal-end",
                    timestamp: goal.target_completion_at ?? null,
                    data: goal,
                  }}
                  dimmed={goal.status !== "completed"}
                />
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function buildTimeline(checkins: Checkin[], milestones: Milestone[]) {
  const past: TimelineItem[] = [];
  const upcoming: TimelineItem[] = [];

  for (const c of checkins) {
    past.push({ kind: "checkin", timestamp: c.created_at, data: c });
  }

  for (const m of milestones) {
    if (m.reached_at) {
      past.push({
        kind: "milestone-reached",
        timestamp: m.reached_at,
        data: m,
      });
    } else {
      upcoming.push({
        kind: "milestone-pending",
        timestamp: m.target_date,
        data: m,
      });
    }
  }

  const byTime = (a: TimelineItem, b: TimelineItem) =>
    new Date(a.timestamp ?? 0).getTime() -
    new Date(b.timestamp ?? 0).getTime();

  past.sort(byTime);
  upcoming.sort(byTime);

  return { past, upcoming };
}

function TimelineRow({
  item,
  dimmed,
  benchmarkName,
}: {
  item: TimelineItem;
  dimmed: boolean;
  benchmarkName?: string | null;
}) {
  const date = item.timestamp
    ? new Date(item.timestamp).toLocaleDateString()
    : "—";

  let marker: React.ReactNode;
  let label: string;
  let details: React.ReactNode = null;

  if (item.kind === "checkin") {
    marker = <Dot filled size="sm" />;
    label = "check-in";
    details = (
      <>
        {item.data.metric_value != null && (
          <span className="text-xs text-muted-foreground">
            {benchmarkName ?? "value"}: {item.data.metric_value}
          </span>
        )}
        {item.data.notes && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.data.notes}
          </p>
        )}
      </>
    );
  } else if (item.kind === "milestone-reached") {
    marker = <Dot filled size="md" />;
    label = `milestone ${item.data.order_index ?? ""} reached`.trim();
    if (item.data.message) {
      details = (
        <p className="mt-0.5 text-xs italic text-muted-foreground">
          &ldquo;{item.data.message}&rdquo;
        </p>
      );
    }
  } else if (item.kind === "milestone-pending") {
    marker = <Dot size="md" />;
    label = `milestone ${item.data.order_index ?? ""}`.trim();
    if (item.data.message) {
      details = (
        <p className="mt-0.5 text-xs italic text-muted-foreground">
          &ldquo;{item.data.message}&rdquo;
        </p>
      );
    }
  } else {
    // goal-end
    marker = <GoalEndMark />;
    label = "goal end";
  }

  return (
    <li
      className={`flex items-start gap-3 py-2 ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-center shrink-0 w-4 pt-1.5">
        {marker}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm">{label}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {date}
          </span>
        </div>
        {details}
      </div>
    </li>
  );
}

function Dot({
  filled = false,
  size = "md",
}: {
  filled?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  const fill = filled ? "bg-foreground" : "border border-foreground";
  return <div className={`${dim} ${fill} rounded-full`} />;
}

function GoalEndMark() {
  return (
    <span className="text-sm font-bold leading-none select-none">×</span>
  );
}
