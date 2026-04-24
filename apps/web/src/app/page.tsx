// apps/web/src/app/page.tsx
//
// Home page — the dashboard you see after logging in.
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// Placeholder aliases — swap these for real types from packages/shared later.
// Keeping them in one place so the eventual replacement is a single edit.
type Profile = any;
type Goal = any;

const STATUSES = ["active", "completed", "dropped"] as const;
type Status = (typeof STATUSES)[number];

export default function Home() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [status, setStatus] = useState<Status>("active");
  const [profileLoading, setProfileLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile is independent of the status toggle, so it has its own loader.
  // Only fetched on initial mount and on bfcache restore.
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/me");
      const json = await res.json();
      setProfile(json.profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Goals depend on the selected status. Identity changes whenever `status`
  // does, which is what drives the refetch on tab change via the effect below.
  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals?status=${status}`);
      const json = await res.json();
      setGoals(json.goals ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoalsLoading(false);
    }
  }, [status]);

  // Profile: runs once on mount. loadProfile has empty deps so its identity
  // is stable — this effect never re-runs.
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Goals: runs on mount and whenever `status` changes (via loadGoals identity).
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // bfcache safety net: when the browser restores this page from its
  // back-forward cache (e.g. after a back button press), useEffect does NOT
  // re-run because the JS heap was frozen. `pageshow` fires on restore and
  // its `persisted` flag is true only in that case — we use it to refetch
  // both profile and goals and avoid showing stale data.
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        loadProfile();
        loadGoals();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadProfile, loadGoals]);

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-6">
      <TopNav profile={profile} supabase={supabase} />

      {profileLoading && (
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      )}
      {error && <p className="mt-10 text-sm text-red-500">error: {error}</p>}

      {!profileLoading && !error && (
        <>
          <StatsBar profile={profile} />
          <GoalsSection
            goals={goals}
            status={status}
            onStatusChange={setStatus}
            loading={goalsLoading}
          />
        </>
      )}
    </main>
  );
}

function TopNav({
  profile,
  supabase,
}: {
  profile: Profile | null;
  supabase: SupabaseClient;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="flex items-center justify-between pb-4 border-b">
      <h1 className="text-xl font-bold tracking-tight">accomplete</h1>

      <div className="flex items-center gap-4">
        {profile?.display_name && (
          <span className="text-xs text-muted-foreground">
            hi, {profile.display_name}
          </span>
        )}

        <Button variant="outline" size="sm" onClick={handleSignOut}>
          sign out
        </Button>
      </div>
    </nav>
  );
}

function StatsBar({ profile }: { profile: Profile | null }) {
  // Fall back to 0 so the UI always shows a number, even before the
  // profile has loaded or when fields are still null on a new account.
  const score = profile?.total_score ?? 0;
  const globalStreak = profile?.global_streak ?? 0;
  const bestStreak = profile?.highest_streak ?? 0;

  return (
    <div className="grid grid-cols-3 gap-3 mt-8">
      <StatCell label="score" value={score} />
      <StatCell label="global streak" value={globalStreak} />
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

function GoalsSection({
  goals,
  status,
  onStatusChange,
  loading,
}: {
  goals: Goal[];
  status: Status;
  onStatusChange: (s: Status) => void;
  loading: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <StatusTabs
          status={status}
          count={goals.length}
          onChange={onStatusChange}
          loading={loading}
        />

        <Button asChild size="sm">
          <Link href="/goals/new">+ add goal</Link>
        </Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          loading...
        </p>
      ) : goals.length === 0 ? (
        <EmptyGoals status={status} />
      ) : (
        <GoalList goals={goals} />
      )}
    </section>
  );
}

// Three tabs replacing the old "active goals [N]" label. The selected tab
// inverts its fill and displays the count of goals in that status; unselected
// tabs are plain muted text. The count is hidden while goals are loading to
// avoid briefly showing the previous status's count under the new tab.
function StatusTabs({
  status,
  count,
  onChange,
  loading,
}: {
  status: Status;
  count: number;
  onChange: (s: Status) => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {STATUSES.map((s) => {
        const selected = s === status;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={
              selected
                ? "px-2 py-1 rounded bg-foreground text-background text-xs uppercase tracking-widest"
                : "px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {s}
            {selected && !loading && <span className="ml-1">[{count}]</span>}
          </button>
        );
      })}
    </div>
  );
}

function EmptyGoals({ status }: { status: Status }) {
  // Only the active tab gets the encouraging CTA — you don't "add" a
  // completed or dropped goal, so those just show a plain empty line.
  if (status === "active") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">no active goals yet.</p>
          <p className="text-xs text-muted-foreground">
            create your first one and start building the streak.
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link href="/goals/new">+ add goal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const message =
    status === "completed" ? "no completed goals yet." : "no dropped goals.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function GoalList({ goals }: { goals: Goal[] }) {
  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} />
      ))}
    </div>
  );
}

// Two-column card: goal info on the left, score+streak on the right.
// The whole card is a single <Link> so clicking anywhere navigates.
function GoalCard({ goal }: { goal: Goal }) {
  const deadline = goal.target_completion_at
    ? new Date(goal.target_completion_at).toLocaleDateString()
    : "—";

  const score = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const streak = goal.current_streak ?? 0;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block transition-opacity hover:opacity-80"
    >
      <Card>
        <CardContent className="flex items-stretch gap-4">
          {/* left — goal info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-heading text-sm font-medium truncate">
                {goal.goal_name}
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
                  {goal.benchmark_target_value} {goal.benchmark_name}
                </span>
              </span>
              <span>
                freq:{" "}
                <span className="text-foreground">{goal.checkin_frequency}</span>
              </span>
              <span>
                deadline: <span className="text-foreground">{deadline}</span>
              </span>
            </div>
          </div>

          {/* right — score + streak */}
          <div className="flex flex-col items-end justify-between border-l pl-4 min-w-[84px]">
            <MiniStat label="score" value={score.toLocaleString()} />
            <MiniStat label="streak" value={streak.toString()} />
          </div>
        </CardContent>
      </Card>
    </Link>
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
