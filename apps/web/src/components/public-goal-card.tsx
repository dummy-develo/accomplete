// Public-facing goal card used by feed + public profile pages. Mirrors the
// visual language of <TodayGoalCard> but:
//   - Optionally renders an author header (feed shows it; profile doesn't).
//   - Respects per-field privacy toggles unless the viewer is the owner.
//   - Links to /goals/[id] for owners, /goals/public/[id] for everyone else.
import Link from "next/link";
import { ProgressWithMarker } from "@/components/atoms/progress-with-marker";

type Goal = any;

type PublicGoalCardProps = {
  goal: Goal;
  // Show the author row (avatar + name + handle). Set true on the feed,
  // false on the profile (where every card is already from the same person).
  showAuthor?: boolean;
  // Owner viewers see private fields unmasked. The non-owner public goals
  // API already strips privates, but profile fetches the raw row when the
  // viewer is the owner, so the masking logic stays here too.
  isOwner?: boolean;
};

export function PublicGoalCard({
  goal,
  showAuthor = false,
  isOwner = false,
}: PublicGoalCardProps) {
  const author = goal.author;
  const name =
    isOwner || goal.is_goal_name_public !== false
      ? goal.goal_name
      : "Private goal";
  const description =
    isOwner || goal.is_description_public !== false
      ? goal.goal_description
      : null;
  const benchmarkName =
    isOwner || goal.is_benchmark_name_public !== false
      ? goal.benchmark_name
      : null;

  const category = goal.category ?? null;
  const targetText =
    benchmarkName && goal.benchmark_target_value != null
      ? `${goal.benchmark_target_value} ${benchmarkName}`
      : benchmarkName;

  const points = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
  const streak = goal.current_streak ?? 0;
  const href = isOwner ? `/goals/${goal.id}` : `/goals/public/${goal.id}`;

  return (
    <article className="flex flex-col gap-3">
      {showAuthor && author && (
        <Link
          href={`/profile/${author.username}`}
          className="flex items-center gap-2 w-fit group"
        >
          <span className="size-6 rounded-full bg-muted shrink-0 flex items-center justify-center text-[10px] font-mono">
            {(author.display_name || author.username || "??")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="text-xs text-foreground group-hover:underline">
            {author.display_name ?? author.username}
          </span>
          <span className="text-xs text-muted-foreground">
            @{author.username}
          </span>
        </Link>
      )}

      <Link
        href={href}
        className="block bg-card border border-border rounded-xl p-5 surface-gloss transition-colors hover:bg-card/70"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {category && (
                <div className="font-mono text-xs text-muted-foreground tracking-wide mb-1.5 truncate">
                  {category}
                </div>
              )}
              <h3 className="text-base font-semibold truncate text-foreground">
                {name}
              </h3>
              {description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 break-words">
                  {description}
                </p>
              )}
            </div>
          </div>

          {goal.target_completion_at && goal.created_at && (
            <ProgressWithMarker
              start={new Date(goal.created_at)}
              end={new Date(goal.target_completion_at)}
            />
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <CardStat label="streak" value={streak} />
            <CardStat label="points" value={points.toLocaleString()} />
            {targetText && <CardStat label="target" value={targetText} />}
            <CardStat label="status" value={goal.status ?? "active"} />
          </div>
        </div>
      </Link>
    </article>
  );
}

function CardStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  );
}
