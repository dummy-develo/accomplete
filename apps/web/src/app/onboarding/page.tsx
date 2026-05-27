"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FIELD_LIMITS, validateUsername } from "@/lib/constants";
import { cn } from "@/lib/utils";

// idle    — field empty, nothing to show
// checking — valid format, availability query in flight (debounced)
// available — valid format and not taken
// taken    — valid format but already in use
// invalid  — fails the format rule (length / characters)
type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export default function Onboarding() {
  // createClient() returns a new client each call, so memoize — otherwise
  // the username-check effect below would re-run on every render.
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live username check: validate format immediately, then debounce the
  // availability query so we don't hit the DB on every keystroke.
  useEffect(() => {
    if (username === "") {
      setStatus("idle");
      setMessage("");
      return;
    }

    const formatError = validateUsername(username);
    if (formatError) {
      setStatus("invalid");
      setMessage(formatError);
      return;
    }

    setStatus("checking");
    setMessage("checking availability...");

    // `active` guards against a stale query resolving after the user has
    // typed more — only the latest effect's result is allowed to land.
    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (!active) return;

      if (data) {
        setStatus("taken");
        setMessage("username unavailable");
      } else {
        setStatus("available");
        setMessage("username available");
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username, supabase]);

  async function saveProfile() {
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          display_name: displayName.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSaveError(json.error?.message ?? "failed to save profile");
        return;
      }

      router.push("/");
    } catch {
      setSaveError("something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const borderClass =
    status === "available"
      ? "border-primary"
      : status === "invalid" || status === "taken"
        ? "border-destructive"
        : "";

  const messageClass =
    status === "available"
      ? "text-primary"
      : status === "invalid" || status === "taken"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="font-mono text-sm tracking-[0.18em]">ACCOMPLETE</h1>
          <p className="mt-6 text-xl">Set up your profile</p>
          <p className="mt-2 text-xs text-muted-foreground">
            pick a username and a display name.
          </p>
        </header>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="displayName"
                className="text-xs text-muted-foreground"
              >
                display name
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={FIELD_LIMITS.displayName}
                placeholder="how your name appears to others"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="username"
                className="text-xs text-muted-foreground"
              >
                username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={FIELD_LIMITS.username}
                placeholder="3–10 letters and numbers"
                className={cn(borderClass)}
              />
              {message && (
                <p className={`text-xs ${messageClass}`}>{message}</p>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-destructive" role="alert">
                {saveError}
              </p>
            )}

            {/*
              suppressHydrationWarning: browsers (Firefox especially) restore
              a button's `disabled` state from session history before React
              hydrates, so the live DOM differs from the server HTML. React
              still controls the button after hydration.
            */}
            <Button
              type="button"
              disabled={status !== "available" || saving}
              onClick={saveProfile}
              className="mt-1 w-full"
              suppressHydrationWarning
            >
              {saving ? "saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
