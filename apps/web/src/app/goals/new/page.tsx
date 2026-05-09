// apps/web/src/app/goals/new/page.tsx
//
// Goal creation wizard — 4 steps: details, privacy, message, preview.
// All steps rendered in one client page; a `step` number controls which
// step is visible. No route changes between steps.
"use client";

import { House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STEPS = ["details", "privacy", "message", "preview"] as const;

// Privacy sub-field labels, keyed by form field name
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

const INITIAL_FORM: FormData = {
  goal_name: "",
  goal_description: "",
  goal_type: "",
  benchmark_name: "",
  benchmark_target_value: "",
  target_completion_at: "",
  completion_message: "",
  is_public: false,
  is_goal_name_public: true,
  is_username_public: true,
  is_description_public: true,
  is_goal_type_public: true,
  are_checkins_public: true,
  is_benchmark_name_public: true,
};

export default function NewGoal() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-step validation message (only step 1 needs it for now)
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    // Validate step 1 required fields before proceeding
    if (step === 1) {
      if (!form.goal_name.trim()) {
        setValidationError("goal name is required");
        return;
      }
      if (!form.target_completion_at) {
        setValidationError("target finish date is required");
        return;
      }
    }
    setValidationError(null);
    setStep((s) => Math.min(s + 1, 4));
  }

  function goBack() {
    setValidationError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      goal_name: form.goal_name,
      goal_description: form.goal_description || null,
      goal_type: form.goal_type || null,
      benchmark_name: form.benchmark_name || null,
      benchmark_target_value: form.benchmark_target_value
        ? Number(form.benchmark_target_value)
        : null,
      target_completion_at: form.target_completion_at
        ? new Date(form.target_completion_at).toISOString()
        : null,
      completion_message: form.completion_message || null,
      is_public: form.is_public,
    };

    // Only send per-field privacy toggles when the goal is public
    if (form.is_public) {
      body.is_goal_name_public = form.is_goal_name_public;
      body.is_username_public = form.is_username_public;
      body.is_description_public = form.is_description_public;
      body.is_goal_type_public = form.is_goal_type_public;
      body.are_checkins_public = form.are_checkins_public;
      body.is_benchmark_name_public = form.is_benchmark_name_public;
    }

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

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      <Card className="mt-6">
        <CardContent className="py-6">
          <div className="flex flex-col gap-5">
            {step === 1 && <StepDetails form={form} updateField={updateField} />}
            {step === 2 && <StepPrivacy form={form} updateField={updateField} />}
            {step === 3 && <StepMessage form={form} updateField={updateField} />}
            {step === 4 && <StepPreview form={form} />}

            {/* Validation / submission errors */}
            {(validationError || error) && (
              <p className="text-sm text-red-500" role="alert">
                {validationError ?? error}
              </p>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {step === 1 && (
                <Button variant="outline" asChild type="button">
                  <Link href="/">cancel</Link>
                </Button>
              )}
              {step > 1 && (
                <Button variant="outline" type="button" onClick={goBack}>
                  back
                </Button>
              )}
              {step < 4 && (
                <Button type="button" onClick={goNext}>
                  next
                </Button>
              )}
              {step === 4 && (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "creating..." : "create goal"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        return (
          <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                isActive || isCompleted
                  ? "bg-foreground"
                  : "border border-muted-foreground bg-transparent"
              }`}
            />
            <span
              className={`text-xs ${
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Goal Details                                              */
/* ------------------------------------------------------------------ */

function StepDetails({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <>
      <Field label="goal name" htmlFor="goal_name" required>
        <Input
          id="goal_name"
          value={form.goal_name}
          onChange={(e) => updateField("goal_name", e.target.value)}
        />
      </Field>

      <Field label="description" htmlFor="goal_description">
        <textarea
          id="goal_description"
          value={form.goal_description}
          onChange={(e) => updateField("goal_description", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>

      <Field label="goal type" htmlFor="goal_type">
        <Input
          id="goal_type"
          value={form.goal_type}
          onChange={(e) => updateField("goal_type", e.target.value)}
          placeholder="workout, learning, project..."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="benchmark name" htmlFor="benchmark_name">
          <Input
            id="benchmark_name"
            value={form.benchmark_name}
            onChange={(e) => updateField("benchmark_name", e.target.value)}
            placeholder="hours, pages, km..."
          />
        </Field>

        <Field label="target value" htmlFor="benchmark_target_value">
          <Input
            id="benchmark_target_value"
            type="number"
            step="any"
            value={form.benchmark_target_value}
            onChange={(e) =>
              updateField("benchmark_target_value", e.target.value)
            }
          />
        </Field>
      </div>

      <Field label="target finish date" htmlFor="target_completion_at" required>
        <Input
          id="target_completion_at"
          type="date"
          value={form.target_completion_at}
          onChange={(e) => updateField("target_completion_at", e.target.value)}
        />
      </Field>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Privacy                                                   */
/* ------------------------------------------------------------------ */

function StepPrivacy({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_public}
          onChange={(e) => updateField("is_public", e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm">
          make this goal public
          <span className="ml-2 text-xs text-muted-foreground">
            (once public, can&apos;t be made private)
          </span>
        </span>
      </label>

      {form.is_public && (
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
                checked={form[key]}
                onChange={(e) => updateField(key, e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Completion Message                                        */
/* ------------------------------------------------------------------ */

function StepMessage({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <Field label="completion message" htmlFor="completion_message">
      <textarea
        id="completion_message"
        value={form.completion_message}
        onChange={(e) => updateField("completion_message", e.target.value)}
        rows={4}
        placeholder="a message from present-you to future-you, revealed when you finish."
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Preview                                                   */
/* ------------------------------------------------------------------ */

function StepPreview({ form }: { form: FormData }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        review your goal
      </h2>

      <PreviewRow label="goal name" value={form.goal_name} />
      <PreviewRow label="description" value={form.goal_description} />
      <PreviewRow label="goal type" value={form.goal_type} />
      <PreviewRow label="benchmark" value={
        form.benchmark_name
          ? `${form.benchmark_name}${form.benchmark_target_value ? ` — target: ${form.benchmark_target_value}` : ""}`
          : null
      } />
      <PreviewRow label="target finish date" value={form.target_completion_at} />
      <PreviewRow
        label="privacy"
        value={form.is_public ? "public" : "private"}
      />
      {form.is_public && (
        <div className="pl-4 flex flex-col gap-1">
          {PRIVACY_TOGGLES.map(({ key, label }) => (
            <span key={key} className="text-sm text-muted-foreground">
              {label}: {form[key] ? "visible" : "hidden"}
            </span>
          ))}
        </div>
      )}
      <PreviewRow label="completion message" value={form.completion_message} />
    </div>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value || "none"}</span>
    </div>
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

// Tiny wrapper that gives every field the same label-above-input layout
// with an optional required asterisk.
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
