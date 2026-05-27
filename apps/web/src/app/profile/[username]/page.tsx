// Profile page — works for both your own profile and others'. Ownership
// detected by comparing the viewed profile's id with the logged-in user's id.
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { BackLink } from "@/components/atoms/back-link";
import { Button } from "@/components/ui/button";
import { HeroStat } from "@/components/atoms/hero-stat";
import { PublicGoalCard } from "@/components/public-goal-card";
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
      const [profileRes, goalsRes, meRes, relationRes] = await Promise.all([
        fetch(`/api/profile/${username}`),
        fetch(`/api/profile/${username}/goals`),
        fetch("/api/profile/me"),
        fetch(`/api/profile/${username}/relation`),
      ]);

      if (!profileRes.ok) {
        setError("profile not found");
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

  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) loadData();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadData]);

  return (
    <AppShell>
      <BackLink />

      {loading && (
        <p className="mt-12 text-sm text-muted-foreground">loading...</p>
      )}
      {error && !profile && (
        <p className="mt-12 text-sm text-destructive">{error}</p>
      )}

      {!loading && profile && (
        <ProfileBody
          profile={profile}
          username={username}
          isOwner={isOwner}
          relation={relation}
          onRelationChange={setRelation}
          goals={goals}
        />
      )}
    </AppShell>
  );
}

function ProfileBody({
  profile,
  username,
  isOwner,
  relation,
  onRelationChange,
  goals,
}: {
  profile: Profile;
  username: string;
  isOwner: boolean;
  relation: any;
  onRelationChange: (state: any) => void;
  goals: Goal[];
}) {
  // Block visibility:
  // - iBlockedThem: you blocked them — hide everything but identity + unblock
  // - theyBlockedMe: they blocked you — zeroed stats, no goals, no actions
  // Your own block takes precedence so you can always unblock.
  const iBlockedThem = !isOwner && (relation?.isBlockedByMe ?? false);
  const theyBlockedMe =
    !isOwner && !iBlockedThem && (relation?.isBlockedByThem ?? false);

  return (
    <>
      <IdentitySection
        profile={profile}
        username={username}
        isOwner={isOwner}
        relation={relation}
        onRelationChange={onRelationChange}
      />

      {iBlockedThem ? (
        <div className="mt-12 border border-dashed border-border rounded-xl px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            you blocked @{profile.username}. their stats and goals are hidden.
            unblock to see this profile again.
          </p>
        </div>
      ) : (
        <>
          <StatsRow profile={profile} zeroed={theyBlockedMe} />
          <PublicGoals goals={goals} isOwner={isOwner} />
        </>
      )}
    </>
  );
}

function IdentitySection({
  profile,
  username,
  isOwner,
  relation,
  onRelationChange,
}: {
  profile: Profile;
  username: string;
  isOwner: boolean;
  relation: any;
  onRelationChange: (state: any) => void;
}) {
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const initials = (profile.display_name || profile.username || "??")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="mt-10 flex items-start gap-6">
      <div className="size-20 rounded-full bg-muted shrink-0 flex items-center justify-center text-base font-mono">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight truncate">
          {profile.display_name ?? profile.username}
        </h1>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        {memberSince && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            member since {memberSince}
          </p>
        )}
      </div>

      {isOwner ? (
        <Button variant="outline" size="sm" asChild>
          <Link href="/profile/edit">Edit profile</Link>
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

// Follow/unfollow + block/unblock. No client-side logic — each button just
// hits the endpoint and adopts whatever relation state it returns.
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
  const iBlockedThem = relation?.isBlockedByMe ?? false;
  const theyBlockedMe = relation?.isBlockedByThem ?? false;

  if (iBlockedThem) {
    return (
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => act("block", "DELETE")}
      >
        unblock
      </Button>
    );
  }

  // They blocked you — render nothing (the viewer shouldn't know).
  if (theyBlockedMe) return null;

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        disabled={busy}
        onClick={() => act("follow", isFollowing ? "DELETE" : "POST")}
      >
        {isFollowing ? "unfollow" : "follow"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => act("block", "POST")}
      >
        block
      </Button>
    </div>
  );
}

function StatsRow({ profile, zeroed }: { profile: Profile; zeroed?: boolean }) {
  // zeroed: render every stat as 0 when the viewer is blocked. Real numbers
  // would leak progress information to a blocked observer.
  const v = (n: number) => (zeroed ? 0 : n);
  return (
    <section className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
      <HeroStat label="Score" value={v(profile.total_score ?? 0).toLocaleString()} />
      <HeroStat label="Current streak" value={v(profile.global_streak ?? 0)} />
      <HeroStat label="Best streak" value={v(profile.highest_streak ?? 0)} />
      <HeroStat label="Active" value={v(profile.active_goals_count ?? 0)} />
      <HeroStat label="Completed" value={v(profile.completed_goals_count ?? 0)} />
      <HeroStat label="Dropped" value={v(profile.dropped_goals_count ?? 0)} />
    </section>
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
    <section className="mt-14">
      <div className="flex items-baseline gap-3 mb-5">
        <h2 className="text-sm font-semibold">Public goals</h2>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {goals.length}
        </span>
      </div>

      {goals.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            no public goals yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => (
            <PublicGoalCard key={goal.id} goal={goal} isOwner={isOwner} />
          ))}
        </div>
      )}
    </section>
  );
}
