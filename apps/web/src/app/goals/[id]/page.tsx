// apps/web/src/app/goals/[id]/page.tsx
//
// Goal detail page — read-only view of a single goal.
// Layer 1: header, stats, meta. Check-in history, milestones, and
// drop/complete actions come in later layers.
"use client";

import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Goal = any;

export default function GoalDetail() {
  const params = useParams();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadGoal();

    // Same bfcache safety net as the home page — refetch when the
    // browser restores the page from its back-forward cache.
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) loadGoal();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadGoal]);

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-6">
      <TopBar />

      {loading && (
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      )}

      {error && <NotFound message={error} />}

      {!loading && !error && goal && (
        <>
          <GoalHeader goal={goal} />
          <StatsBar goal={goal} />
          <MetaInfo goal={goal} />
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

function GoalHeader({ goal }: { goal: Goal }) {
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
        <StatusBadge status={goal.status} />
      </div>
    </section>
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
  // Total goal score is check-in points + milestone bonuses.
  const score = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
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
