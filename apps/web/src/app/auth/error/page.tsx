import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="font-mono text-sm tracking-[0.18em]">ACCOMPLETE</h1>
          <p className="mt-6 text-xl">Verification failed</p>
          <p className="mt-2 text-xs text-muted-foreground">
            something went wrong with your verification link. it may have
            expired or already been used.
          </p>
        </header>

        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/signup"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            try signing up again
          </Link>
        </p>
      </div>
    </main>
  );
}
