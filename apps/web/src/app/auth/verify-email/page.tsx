"use client";

import { Button } from "@/components/ui/button";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VerifyEmail() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  // Carried over from the signup redirect so resend works after a refresh.
  const email = searchParams.get("email") ?? "";
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function handleResend() {
    if (!email) return;
    setStatus("");
    setSending(true);

    const { error } = await supabase.auth.resend({ type: "signup", email });

    // Supabase rate-limits resends (~60s); surface that instead of failing silently.
    setStatus(error ? error.message : "sent — check your inbox again");
    setSending(false);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="font-mono text-sm tracking-[0.18em]">ACCOMPLETE</h1>
          <p className="mt-6 text-xl">Check your inbox</p>
          <p className="mt-2 text-xs text-muted-foreground">
            we sent a verification link
            {email ? (
              <>
                {" "}
                to <span className="text-foreground">{email}</span>
              </>
            ) : null}
            . click it to continue.
          </p>
        </header>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            didn&apos;t get it? check spam, or resend below.
          </p>

          <Button
            type="button"
            onClick={handleResend}
            disabled={sending || !email}
            className="w-full"
          >
            {sending ? "sending..." : "Resend email"}
          </Button>

          {status && (
            <p className="text-xs text-muted-foreground" role="status">
              {status}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          already verified?{" "}
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
