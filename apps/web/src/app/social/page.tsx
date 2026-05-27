// Social — your follow graph and discovery surface. Layout mirrors the
// rest of the redesigned app (HeroStat row, mono caption, restrained
// typography); the page itself fans out into:
//   1. counts row (following / followers)
//   2. global username search (popover of matches)
//   3. tab toggle between Following / Followers
//   4. list of profile rows with the right CTA per side
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { HeroStat } from "@/components/atoms/hero-stat";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Profile = any;
type FollowerProfile = Profile & { isFollowingBack?: boolean };

export default function SocialPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, followingRes, followersRes] = await Promise.all([
        fetch("/api/profile/me"),
        fetch("/api/profile/me/following"),
        fetch("/api/profile/me/followers"),
      ]);
      const [meJson, followingJson, followersJson] = await Promise.all([
        meRes.json(),
        followingRes.json(),
        followersRes.json(),
      ]);
      setMe(meJson.profile);
      setFollowing(followingJson.profiles ?? []);
      setFollowers(followersJson.profiles ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // bfcache refetch — keeps the lists honest when the user navigates back
  // from a profile they followed/unfollowed on the other page.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) load();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [load]);

  return (
    <AppShell>
      <h1 className="text-sm text-muted-foreground">social</h1>

      {loading && (
        <p className="mt-12 text-sm text-muted-foreground">loading...</p>
      )}

      {!loading && (
        <>
          <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            <HeroStat
              label="Following"
              value={(me?.following_count ?? following.length).toLocaleString()}
            />
            <HeroStat
              label="Followers"
              value={(me?.followers_count ?? followers.length).toLocaleString()}
            />
          </section>

          <section className="mt-12">
            <SearchBar
              ownUsername={me?.username ?? null}
              onFollowChange={load}
            />
          </section>

          <section className="mt-10">
            <ListsTabs
              following={following}
              followers={followers}
              onFollowChange={load}
            />
          </section>
        </>
      )}
    </AppShell>
  );
}

// Debounced search — fires /api/profile/search 250ms after the last keystroke.
// Results render as a small popover; closing happens on Escape, blur (with a
// short delay so clicks land), or explicit X click.
function SearchBar({
  ownUsername,
  onFollowChange,
}: {
  ownUsername: string | null;
  onFollowChange: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    // 250ms debounce — fast enough to feel live, slow enough to not flood.
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = await res.json();
        setResults(json.profiles ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // Hide self from search results — there's no useful action you can take
  // against your own row from here.
  const visible = useMemo(
    () => results.filter((r) => r.username !== ownUsername),
    [results, ownUsername],
  );

  return (
    <div className="relative max-w-md">
      <div className="relative">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="search by username or name…"
          className="pl-8 pr-8 h-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div
          className="absolute z-10 left-0 right-0 mt-1 bg-popover border border-border rounded-md surface-gloss overflow-hidden"
          // Close on outside click — relies on the document-level mousedown
          // fired by clicks anywhere outside this absolutely-positioned panel.
          onMouseDown={(e) => e.stopPropagation()}
        >
          {searching && (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              searching…
            </p>
          )}
          {!searching && visible.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              no matches.
            </p>
          )}
          {!searching && visible.length > 0 && (
            <ul className="flex flex-col">
              {visible.map((p) => (
                <li key={p.username}>
                  <SearchResultRow
                    profile={p}
                    onFollowChange={onFollowChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  profile,
  onFollowChange,
}: {
  profile: Profile;
  onFollowChange: () => void;
}) {
  // The search response is intentionally lean; per-row "are we following
  // them?" would require a join we don't do. Skip the inline follow CTA on
  // search results and rely on the destination profile to confirm state.
  // The row itself is a link straight to the profile page.
  return (
    <Link
      href={`/profile/${profile.username}`}
      onClick={() => onFollowChange()}
      className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
    >
      <Avatar profile={profile} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground truncate">
          {profile.display_name ?? profile.username}
        </div>
        <div className="font-mono text-xs text-muted-foreground truncate">
          @{profile.username}
        </div>
      </div>
    </Link>
  );
}

function ListsTabs({
  following,
  followers,
  onFollowChange,
}: {
  following: Profile[];
  followers: FollowerProfile[];
  onFollowChange: () => void;
}) {
  return (
    <Tabs defaultValue="following" className="w-full">
      <TabsList variant="line">
        <TabsTrigger value="following">
          Following
          <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
            {following.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="followers">
          Followers
          <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
            {followers.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="following" className="mt-5">
        {following.length === 0 ? (
          <EmptyState message="you don't follow anyone yet." />
        ) : (
          <ProfileList
            profiles={following}
            renderAction={(p) => (
              <UnfollowButton
                username={p.username}
                onChange={onFollowChange}
              />
            )}
          />
        )}
      </TabsContent>

      <TabsContent value="followers" className="mt-5">
        {followers.length === 0 ? (
          <EmptyState message="no one follows you yet." />
        ) : (
          <ProfileList
            profiles={followers}
            renderAction={(p) =>
              p.isFollowingBack ? (
                <UnfollowButton
                  username={p.username}
                  onChange={onFollowChange}
                />
              ) : (
                <FollowButton
                  username={p.username}
                  onChange={onFollowChange}
                />
              )
            }
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function ProfileList({
  profiles,
  renderAction,
}: {
  profiles: Profile[];
  renderAction: (p: Profile) => React.ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {profiles.map((p) => (
        <li
          key={p.id ?? p.username}
          className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 surface-gloss"
        >
          <Link
            href={`/profile/${p.username}`}
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <Avatar profile={p} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate group-hover:underline">
                {p.display_name ?? p.username}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate">
                @{p.username}
              </div>
            </div>
          </Link>
          <div className="shrink-0">{renderAction(p)}</div>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ profile }: { profile: Profile }) {
  const initials = (profile.display_name || profile.username || "??")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="size-8 rounded-full bg-muted shrink-0 flex items-center justify-center text-[10px] font-mono">
      {initials}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function FollowButton({
  username,
  onChange,
}: {
  username: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await fetch(`/api/profile/${username}/follow`, { method: "POST" });
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <Button size="sm" disabled={busy} onClick={go}>
      Follow back
    </Button>
  );
}

function UnfollowButton({
  username,
  onChange,
}: {
  username: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await fetch(`/api/profile/${username}/follow`, { method: "DELETE" });
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={go}>
      Unfollow
    </Button>
  );
}
