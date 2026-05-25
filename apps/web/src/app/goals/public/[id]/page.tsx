// Read-only view of another user's public goal. Mirrors the layout of the
// owner-facing /goals/[id] page but drops the check-in form, actions
// dropdown, and edit affordances. Private fields arrive already nulled
// from the API (stripPrivateFields); we show "hidden" placeholders for
// the masked ones so the page stays well-shaped.
"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Goal = any;
type Milestone = any;
type Checkin = any;
type Author = { username: string; display_name: string | null; avatar_url: string | null } | null;

export default function PublicGoalPage() {
  const params = useParams();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [author, setAuthor] = useState<Author>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/public/${goalId}`);
      const json = await res.json();
      if (!res.ok || !json.goal) {
        setError("goal not found");
        return;
      }
      setGoal(json.goal);
      setMilestones(json.milestones ?? []);
      setCheckins(json.checkins ?? []);
      setAuthor(json.author ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    load();
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) load();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [load]);

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-6">
      <TopBar />

      {loading && (
        <p className="mt-10 text-sm text-muted-foreground">loading...</p>
      )}

      {error && <NotFound message={error} />}

      {!loading && !error && goal && (
        <>
          <AuthorRow author={author} />
          <GoalHeader goal={goal} />
          <StatsBar goal={goal} />
          <MetaInfo goal={goal} />
          <TimelineSection
            goal={goal}
            milestones={milestones}
            checkins={checkins}
            checkinsHidden={goal.are_checkins_public === false}
          />
        </>
      )}
    </main>
  );
}

function TopBar() {
  return (
    <nav className="flex items-center pb-4 border-b">
      <Link
        href="/feed"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> back to feed
      </Link>
    </nav>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <Card className="mt-10">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          the goal you&apos;re looking for doesn&apos;t exist or isn&apos;t accessible.
        </p>
        <Link
          href="/feed"
          className="mt-2 flex items-center gap-1.5 text-xs underline underline-offset-4"
        >
          <ArrowLeft size={14} /> back to feed
        </Link>
      </CardContent>
    </Card>
  );
}

function AuthorRow({ author }: { author: Author }) {
  if (!author) {
    return (
      <section className="mt-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
        <p className="text-sm text-muted-foreground">anonymous</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <Link
        href={`/profile/${author.username}`}
        className="flex items-center gap-3 w-fit group"
      >
        <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
        <div>
          <p className="text-sm font-medium group-hover:underline">
            {author.display_name ?? author.username}
          </p>
          <p className="text-xs text-muted-foreground">@{author.username}</p>
        </div>
      </Link>
    </section>
  );
}

function GoalHeader({ goal }: { goal: Goal }) {
  const name = goal.goal_name ?? "Private goal";
  const description = goal.goal_description;
  const goalType = goal.goal_type;

  return (
    <section className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight break-words min-w-0">
              {name}
            </h1>
            {goalType && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground break-words min-w-0">
                {goalType}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground break-words whitespace-pre-wrap">
              {description}
            </p>
          )}
        </div>
        <StatusBadge status={goal.status} />
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "bg-foreground text-background border-foreground"
      : status === "dropped"
      ? "border-muted-foreground text-muted-foreground"
      : "border-foreground text-foreground";
  return (
    <span
      className={`text-[10px] uppercase tracking-widest border px-2 py-1 shrink-0 ${classes}`}
    >
      {status}
    </span>
  );
}

function StatsBar({ goal }: { goal: Goal }) {
  const score =
    (goal.score_checkin ?? 0) +
    (goal.score_milestone ?? 0) +
    (goal.score_completion ?? 0);
  const currentStreak = goal.current_streak ?? 0;
  const bestStreak = goal.best_streak ?? 0;

  return (
    <div className="grid grid-cols-3 gap-3 mt-8">
      <StatCell label="score" value={score} />
      <StatCell label="current streak" value={currentStreak} />
      <StatCell label="best streak" value={bestStreak} />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-1 py-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-4xl font-bold tabular-nums leading-none">
          {value.toLocaleString()}
        </span>
      </CardContent>
    </Card>
  );
}

function MetaInfo({ goal }: { goal: Goal }) {
  const deadline = goal.target_completion_at
    ? new Date(goal.target_completion_at).toLocaleDateString()
    : "—";

  const benchmark = goal.benchmark_name ?? "hidden";
  const target = `${goal.benchmark_target_value ?? "—"} ${benchmark}`.trim();

  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        details
      </h2>
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <MetaItem label="target" value={target} />
          <MetaItem label="deadline" value={deadline} />
        </CardContent>
      </Card>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Timeline (read-only, no checkin form)
// ----------------------------------------------------------------------

type TimelineItem = {
  kind: "checkin" | "milestone-reached" | "milestone-pending" | "goal-end";
  timestamp: string | null;
  data: any;
};

function TimelineSection({
  goal,
  milestones,
  checkins,
  checkinsHidden,
}: {
  goal: Goal;
  milestones: Milestone[];
  checkins: Checkin[];
  checkinsHidden: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const { past, upcoming } = buildTimeline(checkins, milestones);

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>timeline</span>
      </button>

      {expanded && (
        <Card>
          <CardContent className="py-4">
            {checkinsHidden && (
              <p className="mb-3 text-xs italic text-muted-foreground">
                this user keeps their check-ins private. milestones are shown
                below.
              </p>
            )}
            {past.length === 0 && upcoming.length === 0 && !goal.target_completion_at ? (
              <p className="text-sm text-muted-foreground">nothing yet.</p>
            ) : (
              <ol className="flex flex-col">
                {past.map((item, i) => (
                  <TimelineRow
                    key={`past-${i}`}
                    item={item}
                    dimmed={false}
                    benchmarkName={goal.benchmark_name}
                  />
                ))}
                {upcoming.map((item, i) => (
                  <TimelineRow
                    key={`up-${i}`}
                    item={item}
                    dimmed={true}
                    benchmarkName={goal.benchmark_name}
                  />
                ))}
                <TimelineRow
                  item={{
                    kind: "goal-end",
                    timestamp: goal.target_completion_at ?? null,
                    data: goal,
                  }}
                  dimmed={goal.status !== "completed"}
                />
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function buildTimeline(checkins: Checkin[], milestones: Milestone[]) {
  const past: TimelineItem[] = [];
  const upcoming: TimelineItem[] = [];

  for (const c of checkins) {
    past.push({ kind: "checkin", timestamp: c.created_at, data: c });
  }

  for (const m of milestones) {
    if (m.reached_at) {
      past.push({
        kind: "milestone-reached",
        timestamp: m.reached_at,
        data: m,
      });
    } else {
      upcoming.push({
        kind: "milestone-pending",
        timestamp: m.target_date,
        data: m,
      });
    }
  }

  const byTime = (a: TimelineItem, b: TimelineItem) =>
    new Date(a.timestamp ?? 0).getTime() -
    new Date(b.timestamp ?? 0).getTime();

  past.sort(byTime);
  upcoming.sort(byTime);

  return { past, upcoming };
}

function TimelineRow({
  item,
  dimmed,
  benchmarkName,
}: {
  item: TimelineItem;
  dimmed: boolean;
  benchmarkName?: string | null;
}) {
  const date = item.timestamp
    ? new Date(item.timestamp).toLocaleDateString()
    : "—";

  let marker: React.ReactNode;
  let label: string;
  let details: React.ReactNode = null;

  if (item.kind === "checkin") {
    marker = <Dot filled size="sm" />;
    label = "check-in";
    details = (
      <>
        {item.data.metric_value != null && (
          <span className="text-xs text-muted-foreground">
            {benchmarkName ?? "value"}: {item.data.metric_value}
          </span>
        )}
        {item.data.notes && (
          <p className="mt-0.5 text-xs text-muted-foreground break-words whitespace-pre-wrap">
            {item.data.notes}
          </p>
        )}
      </>
    );
  } else if (item.kind === "milestone-reached") {
    marker = <Dot filled size="md" />;
    label = `milestone ${item.data.order_index ?? ""} reached`.trim();
    if (item.data.message) {
      details = (
        <p className="mt-0.5 text-xs italic text-muted-foreground break-words whitespace-pre-wrap">
          &ldquo;{item.data.message}&rdquo;
        </p>
      );
    }
  } else if (item.kind === "milestone-pending") {
    marker = <Dot size="md" />;
    label = `milestone ${item.data.order_index ?? ""}`.trim();
    if (item.data.message) {
      details = (
        <p className="mt-0.5 text-xs italic text-muted-foreground break-words whitespace-pre-wrap">
          &ldquo;{item.data.message}&rdquo;
        </p>
      );
    }
  } else {
    marker = <GoalEndMark />;
    label = "goal end";
  }

  return (
    <li className={`flex items-start gap-3 py-2 ${dimmed ? "opacity-40" : ""}`}>
      <div className="flex items-center justify-center shrink-0 w-4 pt-1.5">
        {marker}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm">{label}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {date}
          </span>
        </div>
        {details}
      </div>
    </li>
  );
}

function Dot({
  filled = false,
  size = "md",
}: {
  filled?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  const fill = filled ? "bg-foreground" : "border border-foreground";
  return <div className={`${dim} ${fill} rounded-full`} />;
}

function GoalEndMark() {
  return <span className="text-sm font-bold leading-none select-none">×</span>;
}
