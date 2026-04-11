// apps/web/src/app/goals/new/page.tsx
//
// Goal creation page — single-scroll form that POSTs to /api/goals.
// Deliberately plain: one useState per field, no form library, no
// multi-step wizard. The spec calls for multi-step eventually, but
// for the MVP skeleton a flat form is faster to iterate on.
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewGoal() {
  const router = useRouter();

  const [goalName, setGoalName] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalType, setGoalType] = useState("");
  const [benchmarkName, setBenchmarkName] = useState("");
  const [benchmarkTargetValue, setBenchmarkTargetValue] = useState("");
  const [checkinFrequency, setCheckinFrequency] = useState("");
  const [daysBetweenCheckins, setDaysBetweenCheckins] = useState("");
  const [targetCompletionAt, setTargetCompletionAt] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Build the body to match /api/goals expectations. Number fields are
    // kept as strings in state (HTML inputs always give strings) and only
    // coerced here on submit, so the inputs stay controlled without NaN.
    const body = {
      goal_name: goalName,
      goal_description: goalDescription || null,
      goal_type: goalType || null,
      benchmark_name: benchmarkName || null,
      benchmark_target_value: benchmarkTargetValue
        ? Number(benchmarkTargetValue)
        : null,
      checkin_frequency: checkinFrequency,
      days_between_checkins: daysBetweenCheckins
        ? Number(daysBetweenCheckins)
        : null,
      // <input type="date"> gives a YYYY-MM-DD string; normalize to a full
      // ISO timestamp so Postgres stores a clean timestamptz.
      target_completion_at: targetCompletionAt
        ? new Date(targetCompletionAt).toISOString()
        : null,
      completion_message: completionMessage || null,
      is_public: isPublic,
    };

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.data) {
        setError(json.error?.message ?? "failed to create goal");
        return;
      }

      // Route handler returns { data: <goalRow> } on success. Navigate
      // straight to the new goal's detail page so the user lands on
      // their creation.
      router.push(`/goals/${json.data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6">
      <TopBar />

      <header className="mt-8 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">new goal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          every field you fill in is a thing you can be held accountable to.
        </p>
      </header>

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="goal name" htmlFor="goal_name" required>
              <Input
                id="goal_name"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                required
              />
            </Field>

            <Field label="description" htmlFor="goal_description">
              <textarea
                id="goal_description"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>

            <Field label="goal type" htmlFor="goal_type">
              <Input
                id="goal_type"
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                placeholder="workout, learning, project..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="benchmark name" htmlFor="benchmark_name">
                <Input
                  id="benchmark_name"
                  value={benchmarkName}
                  onChange={(e) => setBenchmarkName(e.target.value)}
                  placeholder="hours, pages, km..."
                />
              </Field>

              <Field label="target value" htmlFor="benchmark_target_value">
                <Input
                  id="benchmark_target_value"
                  type="number"
                  step="any"
                  value={benchmarkTargetValue}
                  onChange={(e) => setBenchmarkTargetValue(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="check-in frequency" htmlFor="checkin_frequency" required>
                <Input
                  id="checkin_frequency"
                  value={checkinFrequency}
                  onChange={(e) => setCheckinFrequency(e.target.value)}
                  placeholder="daily, weekly, monthly..."
                  required
                />
              </Field>

              <Field
                label="days between check-ins"
                htmlFor="days_between_checkins"
                required
              >
                <Input
                  id="days_between_checkins"
                  type="number"
                  step="any"
                  value={daysBetweenCheckins}
                  onChange={(e) => setDaysBetweenCheckins(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label="target finish date" htmlFor="target_completion_at" required>
              <Input
                id="target_completion_at"
                type="date"
                value={targetCompletionAt}
                onChange={(e) => setTargetCompletionAt(e.target.value)}
                required
              />
            </Field>

            <Field label="completion message" htmlFor="completion_message">
              <textarea
                id="completion_message"
                value={completionMessage}
                onChange={(e) => setCompletionMessage(e.target.value)}
                rows={2}
                placeholder="a message from present-you to future-you, revealed when you finish."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">
                make this goal public
                <span className="ml-2 text-xs text-muted-foreground">
                  (once public, can't be made private)
                </span>
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" asChild type="button">
                <Link href="/">cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "creating..." : "create goal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function TopBar() {
  return (
    <nav className="flex items-center pb-4 border-b">
      <Link
        href="/"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← back to home
      </Link>
    </nav>
  );
}

// Tiny wrapper that gives every field the same label-above-input layout
// with an optional required asterisk. Keeps the form body tidy.
function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs uppercase tracking-widest">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
