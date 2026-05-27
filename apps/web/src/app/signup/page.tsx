"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = e.currentTarget;
    const email = form.email.value;
    const password = form.password.value;

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
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
              />
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
