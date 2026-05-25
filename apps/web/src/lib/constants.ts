// Scoring
export const BASE_CHECKIN_VALUE = 10;
export const COMPLETION_MULTIPLIER = 5;

// Milestone tiers — [maxDays, milestoneCount]
// Goals shorter than the first threshold get that count.
// Goals longer than all thresholds get the last count.
export const MILESTONE_TIERS = [
    { maxDays: 30, count: 1 },
    { maxDays: 90, count: 3 },
    { maxDays: Infinity, count: 5 },
];

export function getMilestoneCount(durationDays: number): number {
    for (const tier of MILESTONE_TIERS) {
        if (durationDays < tier.maxDays) return tier.count;
    }
    return MILESTONE_TIERS[MILESTONE_TIERS.length - 1].count;
}

// Form field length caps (characters). Enforced via maxLength on inputs so
// user text stays bounded; goal views also apply break-words as a safety net.
export const FIELD_LIMITS = {
    goalName: 80,
    goalType: 40,
    benchmarkName: 30,
    goalDescription: 500,
    completionMessage: 500,
    checkinNotes: 300,
    username: 10,
    displayName: 50,
} as const;

export const USERNAME_MIN_LENGTH = 3;

// Username rule: 3–10 characters, letters and digits only. Case-sensitive —
// Postgres text comparison treats "Bob" and "bob" as distinct usernames.
// Returns an error message if invalid, or null if the username is acceptable.
export function validateUsername(username: string): string | null {
    if (username.length < USERNAME_MIN_LENGTH) {
        return `username must be at least ${USERNAME_MIN_LENGTH} characters`;
    }
    if (username.length > FIELD_LIMITS.username) {
        return `username must be at most ${FIELD_LIMITS.username} characters`;
    }
    if (!/^[A-Za-z0-9]+$/.test(username)) {
        return "username can only contain letters and numbers";
    }
    return null;
}

// Numeric input bounds. Negatives are meaningless for a target or metric;
// the ceiling keeps absurd values from breaking the stat displays.
export const NUMERIC_BOUNDS = {
    min: 0,
    max: 10_000_000_000,
} as const;

// Clamps a numeric input string to NUMERIC_BOUNDS. Returns "" for empty or
// non-numeric input so the field can stay blank. HTML min/max only style a
// number input — they don't block typing — so this does the real enforcing.
export function clampToBounds(raw: string): string {
    if (raw.trim() === "") return "";
    const n = Number(raw);
    if (Number.isNaN(n)) return "";
    return String(Math.min(Math.max(n, NUMERIC_BOUNDS.min), NUMERIC_BOUNDS.max));
}
