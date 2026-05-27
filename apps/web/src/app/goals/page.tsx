// Goals page — browse all your goals (active, completed, dropped).
// Today shows active only; this page is where you find everything else.
//
// Reuses <PublicGoalCard> with isOwner=true since both surfaces render
// the same owner-side data with the same layout. Author header is off
// because every card on this page is yours.
"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicGoalCard } from "@/components/public-goal-card";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Goal = any;
type Status = "active" | "completed" | "dropped";

const STATUSES: Status[] = ["active", "completed", "dropped"];

export default function GoalsPage() {
  const [status, setStatus] = useState<Status>("active");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals?status=${status}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "failed to load goals");
        setGoals([]);
        return;
      }
      setGoals(json.goals ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // bfcache: refetch on back-forward restore so the list reflects any
  // creates / drops / completions done elsewhere in the app.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) load();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [load]);

  // Client-side name filter. Lists are small (per-user goals), so an API
  // search param isn't worth it yet.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return goals;
    return goals.filter((g) => {
      const name = String(g.goal_name ?? "").toLowerCase();
      const category = String(g.category ?? "").toLowerCase();
      return name.includes(q) || category.includes(q);
    });
  }, [goals, query]);

  return (
    <AppShell>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <Button asChild size="sm">
          <Link href="/goals/new">New goal</Link>
        </Button>
      </div>

      <div className="mt-8 flex items-center gap-1">
        {STATUSES.map((s) => (
          <TabButton key={s} active={status === s} onClick={() => setStatus(s)}>
            {s}
          </TabButton>
        ))}
      </div>

      <div className="mt-5 relative max-w-sm">
        <MagnifyingGlass
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter by name or category..."
          className="pl-9"
        />
      </div>

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState status={status} hasQuery={query.trim().length > 0} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((g) => (
              <PublicGoalCard key={g.id} goal={g} isOwner />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm transition-colors capitalize",
        active
          ? "text-primary bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  status,
  hasQuery,
}: {
  status: Status;
  hasQuery: boolean;
}) {
  if (hasQuery) {
    return (
      <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
        <p className="text-sm text-foreground">nothing matches that.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          try a shorter query, or switch tabs.
        </p>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="border border-dashed border-border rounded-xl px-8 py-16 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-foreground">no active goals.</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          one thing. one deadline. start there.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/goals/new">Create a goal</Link>
        </Button>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
        <p className="text-sm text-foreground">no completed goals yet.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          finish something to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
      <p className="text-sm text-foreground">no dropped goals.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        the empty version of this list is a good sign.
      </p>
    </div>
  );
}
