// Profile edit page — display_name only (username is set at onboarding,
// avatars aren't supported yet). Username is still shown read-only so the
// user has context for what they're editing.
"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = any;

export default function ProfileEditPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/me");
        const json = await res.json();
        if (!res.ok || !json.profile) {
          setError("could not load profile");
          return;
        }
        setProfile(json.profile);
        setDisplayName(json.profile.display_name ?? "");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "failed to save");
        return;
      }
      router.push(`/profile/${profile.username}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 py-6">
        <BackLink username={null} />
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 py-6">
        <BackLink username={null} />
        <p className="mt-10 text-sm text-red-500">{error}</p>
      </main>
    );
  }

  const dirty = (profile?.display_name ?? "") !== displayName.trim();

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6">
      <BackLink username={profile?.username ?? null} />

      <h1 className="mt-6 text-2xl font-bold tracking-tight">edit profile</h1>

      <Card className="mt-6">
        <CardContent className="py-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                username
              </Label>
              <p className="mt-1 text-sm">@{profile.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                username can&apos;t be changed.
              </p>
            </div>

            <div>
              <Label
                htmlFor="display_name"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                display name
              </Label>
              <Input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="how others see you"
                className="mt-1"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? "saving..." : "save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => router.push(`/profile/${profile.username}`)}
              >
                cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function BackLink({ username }: { username: string | null }) {
  const href = username ? `/profile/${username}` : "/";
  return (
    <nav className="pb-4 border-b">
      <Link
        href={href}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> back to profile
      </Link>
    </nav>
  );
}
