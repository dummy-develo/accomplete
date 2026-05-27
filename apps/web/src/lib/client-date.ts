// Client-side "today" computation. The user's stored IANA timezone is the
// single source of truth (set in Settings, default 'UTC'). The browser's
// own clock is no longer trusted for date math — anyone could spoof it, and
// it disagrees with the server when the user travels or sets the wrong zone.

// Returns YYYY-MM-DD in the given IANA timezone. 'en-CA' formats Y/M/D
// natively in that order, so no string juggling. Falls back to UTC if the
// timezone is missing or invalid (Intl throws on a bad zone string).
export function todayInTimezone(timezone?: string | null): string {
  try {
    if (timezone) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
        new Date(),
      );
    }
  } catch {
    // bad timezone — fall through to UTC
  }
  return new Date().toISOString().split("T")[0];
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
