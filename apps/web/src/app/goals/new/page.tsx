// apps/web/src/app/goals/new/page.tsx
//
// New-goal wizard — multi-step. Steps:
//   1. Basics      — name, category, description
//   2. Target      — benchmark + deadline + completion message
//   3. Privacy     — is_public toggle + per-field visibility
//   4. Confirm     — preview of how the goal card will look + create
//
// `step` controls which panel is visible. The whole form is held in one
// state object so the user can navigate back and forth without losing input.
"use client";

import { BackLink } from "@/components/atoms/back-link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressWithMarker } from "@/components/atoms/progress-with-marker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELD_LIMITS, NUMERIC_BOUNDS, clampToBounds } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Target", "Privacy", "Confirm"] as const;

// Predefined category options shown as pills. "custom" reveals a text input.
const CATEGORIES = ["fitness", "learning", "personal", "work", "health"] as const;

const PRIVACY_TOGGLES = [
  { key: "is_goal_name_public", label: "goal name" },
  { key: "is_username_public", label: "username" },
  { key: "is_description_public", label: "description" },
  { key: "are_checkins_public", label: "check-ins" },
  { key: "is_benchmark_name_public", label: "benchmark name" },
] as const;

type FormData = {
  goal_name: string;
  goal_description: string;
  category_selection: string; // "" | one of CATEGORIES | "custom"
  custom_category: string;
  benchmark_name: string;
  benchmark_target_value: string;
  target_completion_at: string;
  completion_message: string;
  is_public: boolean;
  is_goal_name_public: boolean;
  is_username_public: boolean;
  is_description_public: boolean;
  are_checkins_public: boolean;
  is_benchmark_name_public: boolean;
};

const INITIAL_FORM: FormData = {
  goal_name: "",
  goal_description: "",
  category_selection: "",
  custom_category: "",
  benchmark_name: "",
  benchmark_target_value: "",
  target_completion_at: "",
  completion_message: "",
  is_public: false,
  is_goal_name_public: true,
  is_username_public: true,
  is_description_public: true,
  are_checkins_public: true,
  is_benchmark_name_public: true,
};

function resolveCategory(form: FormData): string | null {
  if (form.category_selection === "custom") {
    return form.custom_category.trim() || null;
  }
  return form.category_selection || null;
}

export default function NewGoal() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (step === 1 && !form.goal_name.trim()) {
      setValidationError("goal name is required");
      return;
    }
    if (step === 2 && !form.target_completion_at) {
      setValidationError("target finish date is required");
      return;
    }
    setValidationError(null);
    setStep((s) => Math.min(s + 1, STEPS.length));
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
      category: resolveCategory(form),
      benchmark_name: form.benchmark_name || null,
      benchmark_target_value: form.benchmark_target_value
        ? Number(clampToBounds(form.benchmark_target_value))
        : null,
      target_completion_at: form.target_completion_at
        ? new Date(form.target_completion_at).toISOString()
        : null,
      completion_message: form.completion_message || null,
      is_public: form.is_public,
    };

    if (form.is_public) {
      body.is_goal_name_public = form.is_goal_name_public;
      body.is_username_public = form.is_username_public;
      body.is_description_public = form.is_description_public;
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
    <AppShell>
      <BackLink />

      {/* Centered narrow column for the form. AppShell expands non-rail
          pages to max-w-[1460px]; without this wrapper the form (which is
          intentionally narrow at max-w-2xl) would float flush-left in the
          wider canvas, creating a large right-side gap. */}
      <div className="mx-auto max-w-2xl">
        <header className="mt-8 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            every field you fill in is a thing you can be held accountable to.
          </p>
        </header>

        <StepIndicator currentStep={step} />

        <Card className="mt-8">
        <CardContent className="py-6">
          <div className="flex flex-col gap-6">
            {step === 1 && (
              <StepBasics form={form} updateField={updateField} />
            )}
            {step === 2 && (
              <StepTarget form={form} updateField={updateField} />
            )}
            {step === 3 && (
              <StepPrivacy form={form} updateField={updateField} />
            )}
            {step === 4 && <StepConfirm form={form} />}

            {(validationError || error) && (
              <p className="text-sm text-destructive" role="alert">
                {validationError ?? error}
              </p>
            )}

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
              {step < STEPS.length && (
                <Button type="button" onClick={goNext}>
                  next
                </Button>
              )}
              {step === STEPS.length && (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "creating..." : "Create goal"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const reached = stepNum <= currentStep;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0 transition-colors",
                  reached ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  stepNum === currentStep
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "flex-1 h-px",
                  reached && stepNum < currentStep
                    ? "bg-primary"
                    : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepBasics({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <>
      <Field
        label="goal name"
        htmlFor="goal_name"
        required
        current={form.goal_name.length}
        max={FIELD_LIMITS.goalName}
      >
        <Input
          id="goal_name"
          value={form.goal_name}
          onChange={(e) => updateField("goal_name", e.target.value)}
          maxLength={FIELD_LIMITS.goalName}
          placeholder="run a half marathon"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs uppercase tracking-widest">category</Label>
        <CategoryPicker
          selection={form.category_selection}
          customValue={form.custom_category}
          onSelect={(s) => updateField("category_selection", s)}
          onCustomChange={(v) => updateField("custom_category", v)}
        />
      </div>

      <Field
        label="description"
        htmlFor="goal_description"
        current={form.goal_description.length}
        max={FIELD_LIMITS.goalDescription}
      >
        <textarea
          id="goal_description"
          value={form.goal_description}
          onChange={(e) => updateField("goal_description", e.target.value)}
          rows={3}
          maxLength={FIELD_LIMITS.goalDescription}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
    </>
  );
}

function CategoryPicker({
  selection,
  customValue,
  onSelect,
  onCustomChange,
}: {
  selection: string;
  customValue: string;
  onSelect: (s: string) => void;
  onCustomChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat}
            active={selection === cat}
            onClick={() => onSelect(selection === cat ? "" : cat)}
          >
            {cat}
          </CategoryPill>
        ))}
        <CategoryPill
          active={selection === "custom"}
          onClick={() => onSelect(selection === "custom" ? "" : "custom")}
        >
          custom
        </CategoryPill>
      </div>
      {selection === "custom" && (
        <Input
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="type a category..."
          maxLength={FIELD_LIMITS.goalType}
          autoFocus
        />
      )}
    </div>
  );
}

function CategoryPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs border transition-colors",
        active
          ? "border-primary text-primary bg-primary/10"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function StepTarget({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label="benchmark name"
          htmlFor="benchmark_name"
          current={form.benchmark_name.length}
          max={FIELD_LIMITS.benchmarkName}
        >
          <Input
            id="benchmark_name"
            value={form.benchmark_name}
            onChange={(e) => updateField("benchmark_name", e.target.value)}
            maxLength={FIELD_LIMITS.benchmarkName}
            placeholder="km, pages, hours..."
          />
        </Field>
        <Field label="target value" htmlFor="benchmark_target_value">
          <Input
            id="benchmark_target_value"
            type="number"
            step="any"
            min={NUMERIC_BOUNDS.min}
            max={NUMERIC_BOUNDS.max}
            value={form.benchmark_target_value}
            onChange={(e) =>
              updateField("benchmark_target_value", e.target.value)
            }
            onBlur={(e) =>
              updateField(
                "benchmark_target_value",
                clampToBounds(e.target.value),
              )
            }
            placeholder="21"
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

      <Field
        label="completion message"
        htmlFor="completion_message"
        current={form.completion_message.length}
        max={FIELD_LIMITS.completionMessage}
      >
        <textarea
          id="completion_message"
          value={form.completion_message}
          onChange={(e) => updateField("completion_message", e.target.value)}
          rows={3}
          maxLength={FIELD_LIMITS.completionMessage}
          placeholder="a message from present-you to future-you, revealed when you finish."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
    </>
  );
}

function StepPrivacy({
  form,
  updateField,
}: {
  form: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_public}
          onChange={(e) => updateField("is_public", e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-primary"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm">make this goal public</span>
          <span className="text-xs text-muted-foreground">
            others can see it on your profile and in the feed. once public,
            it can&apos;t be made private.
          </span>
        </span>
      </label>

      {form.is_public && (
        <div className="flex flex-col gap-3 pl-7 border-l-2 border-border">
          <p className="text-xs text-muted-foreground">
            choose which details are visible:
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
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

function StepConfirm({ form }: { form: FormData }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          how it will look on your dashboard
        </p>
        <PreviewCard form={form} />
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <PreviewRow
          label="privacy"
          value={form.is_public ? "public" : "private"}
        />
        {form.completion_message && (
          <PreviewRow
            label="completion message"
            value={form.completion_message}
          />
        )}
      </div>
    </div>
  );
}

// Static lookalike of TodayGoalCard for the new-goal preview. Inlined here
// (rather than reusing the real card) so we don't have to drag a fake `Goal`
// object through the real component's Link wrapper.
function PreviewCard({ form }: { form: FormData }) {
  const category = resolveCategory(form);
  const targetText =
    form.benchmark_target_value && form.benchmark_name
      ? `${form.benchmark_target_value} ${form.benchmark_name}`
      : form.benchmark_name || null;
  const categoryLine =
    [category, targetText].filter(Boolean).join(" · ") || "—";

  const now = new Date();
  const end = form.target_completion_at
    ? new Date(form.target_completion_at)
    : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground mb-1.5 truncate">
            {categoryLine}
          </div>
          <h3 className="text-base font-semibold truncate text-foreground">
            {form.goal_name || "(unnamed goal)"}
          </h3>
        </div>
      </div>

      <ProgressWithMarker start={now} end={end} now={now} />

      <div className="flex items-center gap-6 text-xs">
        <span className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">streak</span>
          <span className="font-mono tabular-nums">0</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">points</span>
          <span className="font-mono tabular-nums">0</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">left</span>
          <span className="font-mono tabular-nums">{daysLeft}d</span>
        </span>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
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

function Field({
  label,
  htmlFor,
  required,
  current,
  max,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  current?: number;
  max?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs uppercase tracking-widest">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {max != null && current != null && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {current}/{max}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
