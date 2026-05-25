"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FIELD_LIMITS, validateUsername } from "@/lib/constants";

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
  // createClient() returns a new client each call, so memoize it — otherwise
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
      ? "border-green-500"
      : status === "invalid" || status === "taken"
      ? "border-red-500"
      : "";

  const messageClass =
    status === "available"
      ? "text-green-600"
      : status === "invalid" || status === "taken"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            set up your profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            pick a username and display name to get started
          </p>
        </header>

        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="displayName"
                  className="text-xs uppercase tracking-widest"
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
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="username"
                  className="text-xs uppercase tracking-widest"
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
                  className={borderClass}
                />
                {message && (
                  <p className={`text-xs ${messageClass}`}>{message}</p>
                )}
              </div>

              {saveError && (
                <p className="text-sm text-red-500" role="alert">
                  {saveError}
                </p>
              )}

              {/*
                suppressHydrationWarning: browsers (Firefox especially)
                restore a button's `disabled` state from session history
                before React hydrates, so the live DOM differs from the
                server HTML. React still controls the button after hydration.
              */}
              <Button
                type="button"
                disabled={status !== "available" || saving}
                onClick={saveProfile}
                className="mt-1"
                suppressHydrationWarning
              >
                {saving ? "saving..." : "save & continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
