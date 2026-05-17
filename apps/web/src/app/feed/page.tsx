// Feed page — Global / Following tabs of public goal cards.
// Goals belong to other people, so cards are not clickable (others'
// goal detail isn't accessible); the author header links to their
// profile instead. Private fields arrive already stripped by the API.
"use client";

import { House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tab = "global" | "following";

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

  const [goals, setGoals] = useState<any[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function urlFor(offset: number) {
    if (tab === "global") {
      return `/api/feed/global?sort=${sort}&status=${status}&limit=${PAGE_SIZE}&offset=${offset}`;
    }
    return `/api/feed/following?limit=${PAGE_SIZE}&offset=${offset}`;
  }

  // First page — refetched whenever tab/sort/status change.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sort, status]);

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
    <main className="w-full max-w-2xl mx-auto px-4 py-6">
      <nav className="flex items-center pb-4 border-b">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <House size={16} /> home
        </Link>
      </nav>

      <h1 className="mt-6 mb-4 text-2xl font-bold tracking-tight">feed</h1>

      {/* Tab toggle */}
      <div className="flex gap-2">
        <TabButton active={tab === "global"} onClick={() => setTab("global")}>
          global
        </TabButton>
        <TabButton
          active={tab === "following"}
          onClick={() => setTab("following")}
        >
          following
        </TabButton>
      </div>

      {/* Sort + status — global tab only */}
      {tab === "global" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Select
            label="sort"
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
          />
          <Select
            label="status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </div>
      )}

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : goals.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="flex flex-col gap-3">
            {goals.map((goal) => (
              <FeedCard key={goal.id} goal={goal} />
            ))}

            {nextOffset !== null && (
              <Button
                variant="outline"
                size="sm"
                className="self-center mt-2"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "loading..." : "load more"}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
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
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
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
        className="rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <Card>
      <CardContent className="py-10 text-center">
        {tab === "global" ? (
          <p className="text-sm text-muted-foreground">
            no public goals here yet.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            you&apos;re not following anyone yet. find people via{" "}
            <Link href="/" className="underline underline-offset-4">
              search
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Author header + goal info. Private fields are already nulled by the
// API (stripPrivateFields), so fall back to placeholders.
function FeedCard({ goal }: { goal: any }) {
  const author = goal.author;
  const deadline = goal.target_completion_at
    ? new Date(goal.target_completion_at).toLocaleDateString()
    : "—";
  const score = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const streak = goal.current_streak ?? 0;

  return (
    <Card>
      <CardContent className="py-4">
        {/* author */}
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-2 mb-3 group w-fit"
          >
            <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
            <span className="text-xs font-medium group-hover:underline">
              {author.display_name ?? author.username}
            </span>
            <span className="text-xs text-muted-foreground">
              @{author.username}
            </span>
          </Link>
        )}

        <div className="flex items-stretch gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-heading text-sm font-medium truncate">
                {goal.goal_name ?? "Private goal"}
              </h3>
              {goal.goal_type && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  {goal.goal_type}
                </span>
              )}
            </div>

            {goal.goal_description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {goal.goal_description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                target:{" "}
                <span className="text-foreground">
                  {goal.benchmark_target_value ?? "—"}{" "}
                  {goal.benchmark_name ?? ""}
                </span>
              </span>
              <span>
                deadline: <span className="text-foreground">{deadline}</span>
              </span>
              <span>
                status: <span className="text-foreground">{goal.status}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end justify-between border-l pl-4 min-w-[84px]">
            <MiniStat label="score" value={score.toLocaleString()} />
            <MiniStat label="streak" value={streak.toString()} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums leading-none mt-0.5">
        {value}
      </div>
    </div>
  );
}
