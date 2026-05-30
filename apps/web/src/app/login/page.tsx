"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // When a login fails because the email isn't confirmed, surface a resend
  // option instead of a dead-end error. Holds the email to resend to.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setUnconfirmedEmail("");
    setResendStatus("");
    setSubmitting(true);

    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setUnconfirmedEmail(email);
      } else {
        setError(error.message);
      }
      setSubmitting(false);
    } else {
      // Middleware routes to /onboarding if no username is set yet.
      router.push("/");
    }
  }

  async function handleResend() {
    setResendStatus("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
    });
    // Supabase rate-limits resends (~60s); show that rather than failing silently.
    setResendStatus(error ? error.message : "sent — check your inbox");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="font-mono text-sm tracking-[0.18em]">ACCOMPLETE</h1>
          <p className="mt-6 text-xl">Sign in</p>
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
              <Input id="password" name="password" type="password" required />
            </div>

            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}

            {unconfirmedEmail && (
              <div className="flex flex-col gap-1.5" role="alert">
                <p className="text-xs text-destructive">
                  please verify your email before signing in.
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  resend verification email
                </button>
                {resendStatus && (
                  <p className="text-xs text-muted-foreground" role="status">
                    {resendStatus}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? "signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
