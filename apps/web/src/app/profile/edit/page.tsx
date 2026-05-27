// Settings page — own profile editing + sign out. Username + display_name
// are functional; the other sections in the redesign spec (Notifications,
// Preferences, Delete account) are stubbed as "coming soon" since their
// underlying features aren't built yet.
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { BackLink } from "@/components/atoms/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FIELD_LIMITS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type Profile = any;

export default function SettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/me");
        const json = await res.json();
        if (!res.ok || !json.profile) {
          setSaveError("could not load profile");
          return;
        }
        setProfile(json.profile);
        setDisplayName(json.profile.display_name ?? "");
      } catch (err: any) {
        setSaveError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);

    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error?.message ?? "failed to save");
        return;
      }
      setProfile(json.profile);
      setSavedMessage("saved");
      window.setTimeout(() => setSavedMessage(null), 1500);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const dirty = (profile?.display_name ?? "") !== displayName.trim();

  return (
    <AppShell>
      <BackLink />

      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Settings</h1>

      {loading && (
        <p className="mt-12 text-sm text-muted-foreground">loading...</p>
      )}

      {!loading && profile && (
        <div className="mt-10 flex flex-col gap-12 max-w-2xl">
          <Section title="Account">
            <Field label="username">
              <p className="text-sm">@{profile.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                username can&apos;t be changed.
              </p>
            </Field>

            <Field label="display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={FIELD_LIMITS.displayName}
                placeholder="how others see you"
              />
            </Field>

            {saveError && (
              <p className="text-xs text-destructive" role="alert">
                {saveError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !dirty}>
                {saving ? "saving..." : "Save"}
              </Button>
              {savedMessage && (
                <span className="text-xs text-muted-foreground">
                  {savedMessage}
                </span>
              )}
            </div>
          </Section>

          <Section
            title="Notifications"
            description="daily reminder time, milestone alerts, feed activity."
          >
            <ComingSoon />
          </Section>

          <Section
            title="Preferences"
            description="date format, week start day. theme is locked to dark."
          >
            <ComingSoon />
          </Section>

          <Section title="Danger zone">
            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={handleSignOut} className="w-fit">
                Sign out
              </Button>
              <p className="text-xs text-muted-foreground">
                delete account: coming soon.
              </p>
            </div>
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ComingSoon() {
  return (
    <p className="text-xs text-muted-foreground italic">coming soon.</p>
  );
}
