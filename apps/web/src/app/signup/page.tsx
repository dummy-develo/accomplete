"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, Eye, EyeSlash } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

// Mirrors the Supabase "lowercase, uppercase, digits and symbols" password
// policy so the user sees what's required before the server rejects it.
// Symbol = any non-alphanumeric character, matching Supabase's symbol set.
const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "number", test: (p: string) => /[0-9]/.test(p) },
  { label: "symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function Signup() {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const unmetRules = PASSWORD_RULES.filter((rule) => !rule.test(password));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = e.currentTarget;
    const email = form.email.value.trim();
    const confirmPassword = form.confirmPassword.value;

    // Block submit until the password meets the Supabase policy, so the user
    // sees the checklist rather than a cryptic server error.
    if (unmetRules.length > 0) {
      setError("password doesn't meet all the requirements");
      setSubmitting(false);
      return;
    }

    // Catch typos before they create an account the user can't log back into.
    if (password !== confirmPassword) {
      setError("passwords don't match");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="font-mono text-sm tracking-[0.18em]">ACCOMPLETE</h1>
          <p className="mt-6 text-xl">Create account</p>
          <p className="mt-2 text-xs text-muted-foreground">
            pick a thing. give it a deadline. show up.
          </p>
        </header>

        <div className="bg-card border border-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                email
              </Label>
              <Input id="email" name="email" type="email" required autoFocus />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="password"
                className="text-xs text-muted-foreground"
              >
                password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "hide password" : "show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className="flex items-center gap-1 text-[11px]"
                      style={{
                        color: met
                          ? "var(--status-success)"
                          : "var(--muted-foreground)",
                      }}
                    >
                      {met ? (
                        <CheckCircle size={12} weight="fill" />
                      ) : (
                        <Circle size={12} />
                      )}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs text-muted-foreground"
              >
                confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "hide password" : "show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? "creating..." : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          already have an account?{" "}
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
