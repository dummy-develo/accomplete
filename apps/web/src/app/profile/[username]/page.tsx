// Profile page — works for both your own profile and other users'.
// Ownership is detected by comparing the profile's ID with the logged-in user's ID.
"use client";

import { House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Profile = any;
type Goal = any;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [relation, setRelation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the viewed profile, their public goals, and the logged-in user in parallel
      const [profileRes, goalsRes, meRes, relationRes] = await Promise.all([
        fetch(`/api/profile/${username}`),
        fetch(`/api/profile/${username}/goals`),
        fetch("/api/profile/me"),
        fetch(`/api/profile/${username}/relation`),
      ]);

      if (!profileRes.ok) {
        setError("Profile not found");
        return;
      }

      const profileJson = await profileRes.json();
      const goalsJson = await goalsRes.json();
      const meJson = await meRes.json();
      const relationJson = await relationRes.json();

      setProfile(profileJson.profile);
      setGoals(goalsJson.goals ?? []);
      setIsOwner(meJson.profile?.id === profileJson.profile?.id);
      setRelation(relationJson.state ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // bfcache: refetch when restored from back-forward cache
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) loadData();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadData]);

  if (loading) {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 py-6">
        <BackLink />
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 py-6">
        <BackLink />
        <p className="mt-10 text-sm text-red-500">
          {error ?? "Profile not found"}
        </p>
      </main>
    );
  }

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-6">
      <BackLink />
      <IdentitySection
        profile={profile}
        isOwner={isOwner}
        username={username}
        relation={relation}
        onRelationChange={setRelation}
      />
      <StatsGrid profile={profile} />
      <PublicGoals goals={goals} isOwner={isOwner} />
    </main>
  );
}

function BackLink() {
  return (
    <nav className="pb-4 border-b">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <House size={16} /> home
      </Link>
    </nav>
  );
}

function IdentitySection({
  profile,
  isOwner,
  username,
  relation,
  onRelationChange,
}: {
  profile: Profile;
  isOwner: boolean;
  username: string;
  relation: any;
  onRelationChange: (state: any) => void;
}) {
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <section className="mt-8 flex items-start gap-5">
      {/* Avatar placeholder */}
      <div className="w-16 h-16 rounded-full bg-muted shrink-0" />

      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold truncate">
          {profile.display_name ?? profile.username}
        </h1>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        {memberSince && (
          <p className="text-xs text-muted-foreground mt-1">
            member since {memberSince}
          </p>
        )}
      </div>

      {isOwner ? (
        <Button variant="outline" size="sm" asChild>
          <Link href="/profile/edit">edit profile</Link>
        </Button>
      ) : (
        <RelationActions
          username={username}
          relation={relation}
          onChange={onRelationChange}
        />
      )}
    </section>
  );
}

// Follow/unfollow + block/unblock. No client-side logic — each button
// just hits the endpoint and adopts whatever relation state it returns.
function RelationActions({
  username,
  relation,
  onChange,
}: {
  username: string;
  relation: any;
  onChange: (state: any) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function act(path: string, method: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/profile/${username}/${path}`, { method });
      const json = await res.json();
      if (res.ok && json.state) onChange(json.state);
    } finally {
      setBusy(false);
    }
  }

  const isFollowing = relation?.isFollowing ?? false;
  const isBlocked = relation?.isBlockedByMe ?? false;

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        disabled={busy}
        onClick={() =>
          act("follow", isFollowing ? "DELETE" : "POST")
        }
      >
        {isFollowing ? "unfollow" : "follow"}
      </Button>
      <Button
        variant={isBlocked ? "destructive" : "outline"}
        size="sm"
        disabled={busy}
        onClick={() => act("block", isBlocked ? "DELETE" : "POST")}
      >
        {isBlocked ? "unblock" : "block"}
      </Button>
    </div>
  );
}

function StatsGrid({ profile }: { profile: Profile }) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-8">
      <StatCell label="score" value={profile.total_score ?? 0} />
      <StatCell label="global streak" value={profile.global_streak ?? 0} />
      <StatCell label="best streak" value={profile.highest_streak ?? 0} />
      <StatCell label="active goals" value={profile.active_goals_count ?? 0} />
      <StatCell
        label="completed"
        value={profile.completed_goals_count ?? 0}
      />
      <StatCell label="dropped" value={profile.dropped_goals_count ?? 0} />
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

function PublicGoals({
  goals,
  isOwner,
}: {
  goals: Goal[];
  isOwner: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
        public goals
      </h2>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-muted-foreground">
              no public goals yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((goal) => (
            <PublicGoalCard key={goal.id} goal={goal} isOwner={isOwner} />
          ))}
        </div>
      )}
    </section>
  );
}

// Goal card for public profile view. Respects privacy toggles unless
// the viewer is the goal's owner (show everything on your own profile).
function PublicGoalCard({
  goal,
  isOwner,
}: {
  goal: Goal;
  isOwner: boolean;
}) {
  // Privacy masking: if not the owner, check per-field toggles
  const name =
    isOwner || goal.is_goal_name_public !== false
      ? goal.goal_name
      : "Private goal";

  const description =
    isOwner || goal.is_description_public !== false
      ? goal.goal_description
      : null;

  const goalType =
    isOwner || goal.is_goal_type_public !== false ? goal.goal_type : null;

  const benchmarkName =
    isOwner || goal.is_benchmark_name_public !== false
      ? goal.benchmark_name
      : "hidden";

  const deadline = goal.target_completion_at
    ? new Date(goal.target_completion_at).toLocaleDateString()
    : "—";

  const score = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const streak = goal.current_streak ?? 0;

  // Link to goal detail page only if you own it
  const Wrapper = isOwner ? OwnerGoalLink : PublicGoalWrapper;

  return (
    <Wrapper goalId={goal.id}>
      <Card>
        <CardContent className="flex items-stretch gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-heading text-sm font-medium truncate">
                {name}
              </h3>
              {goalType && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  {goalType}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                target:{" "}
                <span className="text-foreground">
                  {goal.benchmark_target_value} {benchmarkName}
                </span>
              </span>
              <span>
                deadline: <span className="text-foreground">{deadline}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end justify-between border-l pl-4 min-w-[84px]">
            <MiniStat label="score" value={score.toLocaleString()} />
            <MiniStat label="streak" value={streak.toString()} />
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}

// Clickable link wrapper for owner's own goals
function OwnerGoalLink({
  goalId,
  children,
}: {
  goalId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/goals/${goalId}`}
      className="block transition-opacity hover:opacity-80"
    >
      {children}
    </Link>
  );
}

// Non-clickable wrapper for other users' goals
function PublicGoalWrapper({
  children,
}: {
  goalId?: string;
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
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
