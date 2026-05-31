"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

// 1200 (Today's main column) + 260 (right rail) = 1460 — the horizontal
// footprint occupied on Today. Pages without a rail expand the main column
// to that width so the layout doesn't leave the rail's slot as awkward
// empty space; the page still feels balanced inside the same overall
// envelope.
const MAIN_MAX_WIDTH_WITH_RAIL = "max-w-[1200px]";
const MAIN_MAX_WIDTH_WITHOUT_RAIL = "max-w-[1460px]";

// Below `lg` (1024px) the full three-column desktop layout (sidebar + main +
// rail ≈ 1460px) can't fit, so we collapse: the sidebar becomes a hamburger
// drawer and the rail content stacks under the main column. At `lg`+ the
// original desktop layout is rendered unchanged.
export function AppShell({ children, rightRail }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar — visible at lg+ */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer — the same sidebar slid in over the page */}
      {drawerOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              aria-label="Close menu"
              className="absolute top-5 right-3 text-muted-foreground"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar with hamburger — hidden on desktop */}
        <header className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-border bg-sidebar sticky top-0 z-30">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <List size={22} />
          </button>
          <Link href="/" className="brand-wordmark">
            ACCOMPLETE
          </Link>
        </header>

        <div className="flex-1 min-w-0 flex">
          <main className="flex-1 min-w-0">
            <div
              className={cn(
                "mx-auto px-4 py-6 lg:px-10 lg:py-8",
                rightRail ? MAIN_MAX_WIDTH_WITH_RAIL : MAIN_MAX_WIDTH_WITHOUT_RAIL,
              )}
            >
              {children}

              {/* On mobile the rail can't sit beside the column, so its
                  content stacks below instead of being lost. */}
              {rightRail ? (
                <div className="lg:hidden mt-8 pt-8 border-t border-border">
                  {rightRail}
                </div>
              ) : null}
            </div>
          </main>

          {/* Desktop rail — beside the main column at lg+ */}
          {rightRail ? (
            <aside className="hidden lg:block w-[260px] shrink-0 bg-sidebar border-l border-border h-screen sticky top-0 overflow-y-auto px-6 py-8">
              {rightRail}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
