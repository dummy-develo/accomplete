// apps/web/src/app/goals/[id]/edit/page.tsx
//
// Goal edit page — single scrollable form (not a wizard).
// Fetches the goal on mount, pre-populates all fields, and only sends
// changed fields to PATCH /api/goals/[id]. Blocks editing if the goal
// is not active.
"use client";

import { House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PRIVACY_TOGGLES = [
  { key: "is_goal_name_public", label: "goal name" },
  { key: "is_username_public", label: "username" },
  { key: "is_description_public", label: "description" },
  { key: "is_goal_type_public", label: "goal type" },
  { key: "are_checkins_public", label: "check-ins" },
  { key: "is_benchmark_name_public", label: "benchmark name" },
] as const;

type FormData = {
  goal_name: string;
  goal_description: string;
  goal_type: string;
  benchmark_name: string;
  benchmark_target_value: string;
  target_completion_at: string;
  completion_message: string;
  is_public: boolean;
  is_goal_name_public: boolean;
  is_username_public: boolean;
  is_description_public: boolean;
  is_goal_type_public: boolean;
  are_checkins_public: boolean;
  is_benchmark_name_public: boolean;
};

// Converts the API goal object into form-friendly strings
function goalToForm(goal: any): FormData {
  return {
    goal_name: goal.goal_name ?? "",
    goal_description: goal.goal_description ?? "",
    goal_type: goal.goal_type ?? "",
    benchmark_name: goal.benchmark_name ?? "",
    benchmark_target_value:
      goal.benchmark_target_value != null
        ? String(goal.benchmark_target_value)
        : "",
    // The DB stores a full ISO timestamp; the date input needs YYYY-MM-DD
    target_completion_at: goal.target_completion_at
      ? goal.target_completion_at.slice(0, 10)
      : "",
    completion_message: goal.completion_message ?? "",
    is_public: goal.is_public ?? false,
    is_goal_name_public: goal.is_goal_name_public ?? true,
    is_username_public: goal.is_username_public ?? true,
    is_description_public: goal.is_description_public ?? true,
    is_goal_type_public: goal.is_goal_type_public ?? true,
    are_checkins_public: goal.are_checkins_public ?? true,
    is_benchmark_name_public: goal.is_benchmark_name_public ?? true,
  };
}

export default function EditGoal() {
  const params = useParams();
  const goalId = params.id as string;
  const router = useRouter();

  const [goal, setGoal] = useState<any>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [original, setOriginal] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/goals/${goalId}`);
        const json = await res.json();
        if (!res.ok || !json.goal) {
          setFetchError("goal not found");
          return;
        }
        setGoal(json.goal);
        const formData = goalToForm(json.goal);
        setForm(formData);
        setOriginal(formData);
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [goalId]);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit() {
    if (!form || !original) return;

    // Client-side validation
    if (!form.goal_name.trim()) {
      setError("goal name is required");
      return;
    }
    if (!form.target_completion_at) {
      setError("target finish date is required");
      return;
    }
    if (new Date(form.target_completion_at) <= new Date()) {
      setError("target finish date must be in the future");
      return;
    }

    // Build a diff — only send fields that actually changed
    const body: Record<string, unknown> = {};

    if (form.goal_name !== original.goal_name)
      body.goal_name = form.goal_name;
    if (form.goal_description !== original.goal_description)
      body.goal_description = form.goal_description || null;
    if (form.goal_type !== original.goal_type)
      body.goal_type = form.goal_type || null;
    if (form.benchmark_name !== original.benchmark_name)
      body.benchmark_name = form.benchmark_name || null;
    if (form.benchmark_target_value !== original.benchmark_target_value)
      body.benchmark_target_value = form.benchmark_target_value
        ? Number(form.benchmark_target_value)
        : null;
    if (form.target_completion_at !== original.target_completion_at)
      body.target_completion_at = new Date(
        form.target_completion_at
      ).toISOString();
    if (form.completion_message !== original.completion_message)
      body.completion_message = form.completion_message || null;

    // Privacy fields
    if (form.is_public !== original.is_public) body.is_public = form.is_public;
    if (form.is_public) {
      for (const { key } of PRIVACY_TOGGLES) {
        if (form[key] !== original[key]) body[key] = form[key];
      }
    }

    // Nothing changed
    if (Object.keys(body).length === 0) {
      router.push(`/goals/${goalId}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? json.error ?? "failed to update goal");
        return;
      }

      router.push(`/goals/${goalId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 py-6">
        <TopBar />
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      </main>
    );
  }

  // Goal not found
  if (fetchError || !goal) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 py-6">
        <TopBar />
        <Card className="mt-10">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {fetchError ?? "goal not found"}
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 text-xs underline underline-offset-4"
            >
              <House size={14} /> home
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Non-active goal — read-only message
  if (goal.status !== "active") {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 py-6">
        <TopBar />
        <Card className="mt-10">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              this goal is <strong>{goal.status}</strong> and can no longer be
              edited.
            </p>
            <Link
              href={`/goals/${goalId}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs underline underline-offset-4"
            >
              back to goal
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-6">
      <TopBar />

      <header className="mt-8 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">edit goal</h1>
      </header>

      <div className="flex flex-col gap-6">
        {/* Details section */}
        <Card>
          <CardContent className="py-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              details
            </h2>
            <div className="flex flex-col gap-5">
              <Field label="goal name" htmlFor="goal_name" required>
                <Input
                  id="goal_name"
                  value={form!.goal_name}
                  onChange={(e) => updateField("goal_name", e.target.value)}
                />
              </Field>

              <Field label="description" htmlFor="goal_description">
                <textarea
                  id="goal_description"
                  value={form!.goal_description}
                  onChange={(e) =>
                    updateField("goal_description", e.target.value)
                  }
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>

              <Field label="goal type" htmlFor="goal_type">
                <Input
                  id="goal_type"
                  value={form!.goal_type}
                  onChange={(e) => updateField("goal_type", e.target.value)}
                  placeholder="workout, learning, project..."
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="benchmark name" htmlFor="benchmark_name">
                  <Input
                    id="benchmark_name"
                    value={form!.benchmark_name}
                    onChange={(e) =>
                      updateField("benchmark_name", e.target.value)
                    }
                    placeholder="hours, pages, km..."
                  />
                </Field>

                <Field label="target value" htmlFor="benchmark_target_value">
                  <Input
                    id="benchmark_target_value"
                    type="number"
                    step="any"
                    value={form!.benchmark_target_value}
                    onChange={(e) =>
                      updateField("benchmark_target_value", e.target.value)
                    }
                  />
                </Field>
              </div>

              <Field
                label="target finish date"
                htmlFor="target_completion_at"
                required
              >
                <Input
                  id="target_completion_at"
                  type="date"
                  value={form!.target_completion_at}
                  onChange={(e) =>
                    updateField("target_completion_at", e.target.value)
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Privacy section */}
        <Card>
          <CardContent className="py-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              privacy
            </h2>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form!.is_public}
                  onChange={(e) => updateField("is_public", e.target.checked)}
                  disabled={original!.is_public}
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  make this goal public
                  {original!.is_public && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (public goals cannot be made private)
                    </span>
                  )}
                </span>
              </label>

              {form!.is_public && (
                <div className="flex flex-col gap-3 pl-6 border-l-2 border-muted">
                  <p className="text-xs text-muted-foreground">
                    choose which details are visible to others:
                  </p>
                  {PRIVACY_TOGGLES.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={form![key]}
                        onChange={(e) => updateField(key, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completion message section */}
        <Card>
          <CardContent className="py-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              completion message
            </h2>
            <Field label="message" htmlFor="completion_message">
              <textarea
                id="completion_message"
                value={form!.completion_message}
                onChange={(e) =>
                  updateField("completion_message", e.target.value)
                }
                rows={4}
                placeholder="a message from present-you to future-you, revealed when you finish."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Error + action buttons */}
        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pb-6">
          <Button variant="outline" asChild type="button">
            <Link href={`/goals/${goalId}`}>cancel</Link>
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "saving..." : "save changes"}
          </Button>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <nav className="flex items-center pb-4 border-b">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <House size={16} /> home
      </Link>
    </nav>
  );
}

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
