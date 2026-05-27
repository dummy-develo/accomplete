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

export function AppShell({ children, rightRail }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div
          className={cn(
            "mx-auto px-10 py-8",
            rightRail ? MAIN_MAX_WIDTH_WITH_RAIL : MAIN_MAX_WIDTH_WITHOUT_RAIL,
          )}
        >
          {children}
        </div>
      </main>
      {rightRail ? (
        <aside className="w-[260px] shrink-0 bg-sidebar border-l border-border h-screen sticky top-0 overflow-y-auto px-6 py-8">
          {rightRail}
        </aside>
      ) : null}
    </div>
  );
}
