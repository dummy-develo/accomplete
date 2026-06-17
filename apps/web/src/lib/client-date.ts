// Client-side "today" computation. The user's stored IANA timezone is the
// single source of truth (set in Settings, default 'UTC'). The browser's
// own clock is no longer trusted for date math — anyone could spoof it, and
// it disagrees with the server when the user travels or sets the wrong zone.

// Returns YYYY-MM-DD in the given IANA timezone. 'en-CA' formats Y/M/D
// natively in that order, so no string juggling. Falls back to UTC if the
// timezone is missing or invalid (Intl throws on a bad zone string).
export function todayInTimezone(timezone?: string | null): string {
  return localDateInTimezone(new Date(), timezone);
}

// The local calendar date (YYYY-MM-DD) that `date` falls on in the given zone.
// Generalizes todayInTimezone to any instant — used to compare a goal's
// target_completion_at timestamp against "today" by calendar day.
export function localDateInTimezone(
  date: Date,
  timezone?: string | null,
): string {
  try {
    if (timezone) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
        date,
      );
    }
  } catch {
    // bad timezone — fall through to UTC
  }
  return date.toISOString().split("T")[0];
}

// A goal is "overdue" when it's still active but its target day is strictly in
// the past (in the user's timezone). Mirrors the server gate in checkins.ts —
// the UI uses this only to surface the state and steer the user to extend or
// complete; the server is what actually blocks the check-in.
export function isGoalOverdue(
  goal: { status?: string; target_completion_at?: string | null },
  timezone?: string | null,
): boolean {
  if (!goal || goal.status !== "active" || !goal.target_completion_at) {
    return false;
  }
  const today = todayInTimezone(timezone);
  const targetDay = localDateInTimezone(
    new Date(goal.target_completion_at),
    timezone,
  );
  return targetDay < today;
}

// Day-first display format, e.g. "16 Jun 2026" (or "16 Jun" with
// { withYear: false }). en-GB gives day/month/year ordering with a short month
// name — unambiguous and day-first, unlike the en-US default. Accepts a Date,
// an ISO string, or null (renders "—"). This is the single source of truth for
// how dates are shown across the app — format everything through it.
export function formatDate(
  date: Date | string | null,
  opts: { withYear?: boolean } = {},
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(opts.withYear === false ? {} : { year: "numeric" }),
  }).format(d);
}

// "Mon · 16 Jun 2026" — the weekday-prefixed form used on Today's header and
// the check-in dialog. Weekday locale stays en-US (just an abbreviation).
export function formatMonoDate(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    date,
  );
  return `${weekday} · ${formatDate(date)}`;
}

// The browser's best guess at the user's timezone. Used to seed the profile
// during onboarding so new signups don't all start as UTC.
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
