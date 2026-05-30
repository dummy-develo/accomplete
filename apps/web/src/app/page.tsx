// apps/web/src/app/page.tsx
//
// Today (dashboard) — the home screen users land on every open.
// Layout: sidebar + main + right rail (Today is the only page with the rail).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { HeroStat } from "@/components/atoms/hero-stat";
import { CheckInDialog } from "@/components/check-in-dialog";
import { TodayGoalCard } from "@/components/today/goal-card";
import { TodayRightRail } from "@/components/today/right-rail";
import { todayInTimezone } from "@/lib/client-date";
import {
  Sun,
  SunDim,
  CloudMoon,
  Moon,
  MoonStars,
  type Icon,
} from "@phosphor-icons/react";

// Placeholder aliases — swap for real types from packages/shared later.
type Profile = any;
type Goal = any;

function formatMonoDate(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    date,
  );
  const rest = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
  return `${weekday} · ${rest}`;
}

// Greeting paired with a time-of-day icon and a CSS-var tone. Keeping all
// three in one function means the icon, label, and color always agree on
// the same period boundary — no chance of saying "good morning" with a moon
// icon if someone tweaks one and forgets the other.
type Greeting = { label: string; Icon: Icon; tone: string };

function greetingFor(date: Date): Greeting {
  const h = date.getHours();
  if (h < 5) return { label: "still up", Icon: MoonStars, tone: "var(--tone-night)" };
  if (h < 12) return { label: "good morning", Icon: Sun, tone: "var(--tone-morning)" };
  if (h < 17) return { label: "good afternoon", Icon: SunDim, tone: "var(--tone-afternoon)" };
  if (h < 22) return { label: "good evening", Icon: CloudMoon, tone: "var(--tone-evening)" };
  return { label: "night owl", Icon: Moon, tone: "var(--tone-night)" };
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Goal currently being checked in via the dialog (null = dialog closed).
  const [checkInGoal, setCheckInGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, gRes] = await Promise.all([
        fetch("/api/profile/me"),
        fetch("/api/goals?status=active"),
      ]);
      const [pJson, gJson] = await Promise.all([pRes.json(), gRes.json()]);
      setProfile(pJson.profile);
      setGoals(gJson.goals ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // bfcache: when the browser restores this page from its back-forward cache
  // (e.g. after the user hits Back from goal detail), useEffect does NOT
  // re-run because the JS heap was frozen. `pageshow` with persisted=true
  // fires on restore and lets us refetch so check-in / streak state is fresh.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) load();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [load]);

  const now = new Date();
  // Use the user's stored timezone so "today" matches what the server wrote
  // to last_checkin_date. Profile may not be loaded on first paint — that's
  // fine, the comparison just resolves to UTC for one render until data arrives.
  const today = todayInTimezone(profile?.timezone);
  const monoDate = formatMonoDate(now);
  const greeting = greetingFor(now);
  const firstName =
    profile?.display_name?.split(" ")[0] ?? profile?.username ?? "";

  const pending = goals.filter((g) => g.last_checkin_date !== today);
  const done = goals.filter((g) => g.last_checkin_date === today);

  return (
    <AppShell
      rightRail={
        <TodayRightRail
          pending={pending}
          done={done}
          hasGoals={goals.length > 0}
          todayMonoDate={monoDate}
          onCheckIn={setCheckInGoal}
        />
      }
    >
      <div className="flex items-baseline justify-between">
        <h1 className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <greeting.Icon
            size={14}
            weight="fill"
            style={{ color: greeting.tone }}
            aria-hidden
          />
          <span>
            {greeting.label}
            {firstName ? `, ${firstName.toLowerCase()}` : ""}
          </span>
        </h1>
        <span className="font-mono text-xs text-muted-foreground">
          {monoDate}
        </span>
      </div>

      {loading && (
        <p className="mt-12 text-sm text-muted-foreground">loading...</p>
      )}
      {error && (
        <p className="mt-12 text-sm text-destructive">error: {error}</p>
      )}

      {!loading && !error && (
        <>
          <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            <HeroStat
              label="Points"
              value={(profile?.total_score ?? 0).toLocaleString()}
            />
            <HeroStat
              label="Current streak"
              value={profile?.global_streak ?? 0}
            />
            <HeroStat
              label="Best streak"
              value={profile?.highest_streak ?? 0}
            />
            <HeroStat
              label="Active goals"
              value={profile?.active_goals_count ?? 0}
            />
          </section>

          <section className="mt-14">
            <div className="flex items-baseline justify-between mb-5">
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-semibold">Active goals</h2>
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {goals.length}
                </span>
              </div>
              <Button asChild size="sm">
                <Link href="/goals/new">New goal</Link>
              </Button>
            </div>

            {goals.length === 0 ? (
              <EmptyGoals />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((g) => (
                  <TodayGoalCard
                    key={g.id}
                    goal={g}
                    checkedInToday={g.last_checkin_date === today}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <CheckInDialog
        open={checkInGoal !== null}
        onOpenChange={(open) => {
          if (!open) setCheckInGoal(null);
        }}
        goal={checkInGoal}
        timezone={profile?.timezone}
        onSuccess={load}
      />
    </AppShell>
  );
}

function EmptyGoals() {
  return (
    <div className="border border-dashed border-border rounded-xl px-8 py-16 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-foreground">no goals yet.</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        the first one is the hardest. it&apos;s also the most important.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href="/goals/new">Create your first goal</Link>
      </Button>
    </div>
  );
}
