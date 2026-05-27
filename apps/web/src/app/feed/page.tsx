// Feed page — Global / Following tabs of public goal cards.
//
// The current API returns goals (one row per public goal, optionally with
// embedded author info). The redesign envisions a true activity feed
// (check-ins, milestones reached) — that would require a new API and
// is deferred. For now, we restyle the goals-list view.
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PublicGoalCard } from "@/components/public-goal-card";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Tab = "global" | "following";
type Goal = any;

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "newest", label: "newest" },
  { value: "current_streak", label: "current streak" },
  { value: "best_streak", label: "best streak" },
  { value: "recently_active", label: "recently active" },
  { value: "score", label: "score" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "active" },
  { value: "completed", label: "completed" },
  { value: "dropped", label: "dropped" },
  { value: "all", label: "all" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("global");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState("active");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlFor = useCallback(
    (offset: number) => {
      if (tab === "global") {
        return `/api/feed/global?sort=${sort}&status=${status}&limit=${PAGE_SIZE}&offset=${offset}`;
      }
      return `/api/feed/following?limit=${PAGE_SIZE}&offset=${offset}`;
    },
    [tab, sort, status],
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(urlFor(0));
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "failed to load feed");
        setGoals([]);
        return;
      }
      setGoals(json.goals ?? []);
      setNextOffset(json.nextOffset ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [urlFor]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await fetch(urlFor(nextOffset));
      const json = await res.json();
      if (res.ok) {
        setGoals((prev) => [...prev, ...(json.goals ?? [])]);
        setNextOffset(json.nextOffset ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>

      <div className="mt-8 flex items-center gap-1">
        <TabButton active={tab === "global"} onClick={() => setTab("global")}>
          Global
        </TabButton>
        <TabButton
          active={tab === "following"}
          onClick={() => setTab("following")}
        >
          Following
        </TabButton>
      </div>

      {tab === "global" && (
        <div className="mt-5 flex flex-wrap gap-4">
          <Select label="sort" value={sort} options={SORT_OPTIONS} onChange={setSort} />
          <Select
            label="status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </div>
      )}

      <div className="mt-10">
        {loading ? (
          <p className="text-sm text-muted-foreground">loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : goals.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="flex flex-col gap-6">
            {goals.map((goal) => (
              <PublicGoalCard key={goal.id} goal={goal} showAuthor />
            ))}

            {nextOffset !== null && (
              <Button
                variant="outline"
                size="sm"
                className="self-center mt-2"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "loading..." : "Load more"}
              </Button>
            )}
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
        "px-3 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "text-primary bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="border border-dashed border-border rounded-xl px-8 py-16 flex flex-col items-center gap-3 text-center">
      {tab === "global" ? (
        <>
          <p className="text-sm text-foreground">nothing here yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            once people start sharing public goals, they&apos;ll show up here.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground">no follows yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            following someone fills this feed with their public progress.
            switch to global to see the wider activity.
          </p>
        </>
      )}
    </div>
  );
}
