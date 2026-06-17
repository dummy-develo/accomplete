import { SupabaseClient } from "@supabase/supabase-js";

// Returns "today" as YYYY-MM-DD in the given IANA timezone (e.g.
// "Asia/Kolkata"). The 'en-CA' locale formats Y/M/D natively as YYYY-MM-DD,
// so no string juggling is needed. Falls back to UTC if the zone is missing
// or invalid — Intl throws on a bad timezone string, and we'd rather degrade
// gracefully than 500 a check-in.
export function todayInTimezone(timezone?: string | null): string {
    return localDateInTimezone(new Date(), timezone);
}

// Same as todayInTimezone but for an arbitrary instant — returns the local
// calendar date (YYYY-MM-DD) that `date` falls on in the given zone. Used to
// compare a goal's target_completion_at (a timestamptz) against "today" by
// calendar day rather than raw instant.
export function localDateInTimezone(date: Date, timezone?: string | null): string {
    try {
        if (timezone) {
            return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
        }
    } catch {
        // Invalid timezone string — fall through to UTC.
    }
    return date.toISOString().split("T")[0];
}

// Returns the day before `today` (YYYY-MM-DD). Parses as UTC to avoid the
// host's timezone shifting the boundary — date arithmetic on date-only
// strings should be timezone-agnostic.
function dayBefore(today: string): string {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
}

// Pure computation — calculates new streak values when a check-in is scored.
// Called from scoreCheckin() so the returned values get written in the same goal update.
export function calculateGoalStreak(
    goal: {
        last_checkin_date: string | null;
        current_streak: number;
        best_streak: number;
    },
    today: string = todayInTimezone(),
): { current_streak: number; best_streak: number } {
    const yesterday = dayBefore(today);

    // Already checked in today — no streak change (extra same-day check-in)
    if (goal.last_checkin_date === today) {
        return {
            current_streak: goal.current_streak,
            best_streak: goal.best_streak,
        };
    }

    // Checked in yesterday — continuing the streak
    if (goal.last_checkin_date === yesterday) {
        const newStreak = (goal.current_streak ?? 0) + 1;
        return {
            current_streak: newStreak,
            best_streak: Math.max(goal.best_streak ?? 0, newStreak),
        };
    }

    // No previous check-in, or last check-in was before yesterday — new streak starts
    return {
        current_streak: 1,
        best_streak: Math.max(goal.best_streak ?? 0, 1),
    };
}

// Pure computation — calculates new global streak values when any check-in is scored.
// Same logic as per-goal streak but operates on the profile's last_checkin_date.
export function calculateGlobalStreak(
    profile: {
        last_checkin_date: string | null;
        global_streak: number;
        highest_streak: number;
    },
    today: string = todayInTimezone(),
): { global_streak: number; highest_streak: number; last_checkin_date: string } {
    const yesterday = dayBefore(today);

    // Already checked in today — no streak change
    if (profile.last_checkin_date === today) {
        return {
            global_streak: profile.global_streak,
            highest_streak: profile.highest_streak,
            last_checkin_date: today,
        };
    }

    // Checked in yesterday — continuing the streak
    if (profile.last_checkin_date === yesterday) {
        const newStreak = (profile.global_streak ?? 0) + 1;
        return {
            global_streak: newStreak,
            highest_streak: Math.max(profile.highest_streak ?? 0, newStreak),
            last_checkin_date: today,
        };
    }

    // No previous check-in or missed a day — new streak starts
    return {
        global_streak: 1,
        highest_streak: Math.max(profile.highest_streak ?? 0, 1),
        last_checkin_date: today,
    };
}

// Write-on-read cleanup: resets global_streak to 0 on the profile if
// last_checkin_date is before yesterday (meaning the user missed a day).
// Returns the profile with corrected streak values.
export async function resetStaleGlobalStreak(
    supabase: SupabaseClient,
    profile: any,
    today: string = todayInTimezone(),
): Promise<any> {
    const yesterday = dayBefore(today);

    if (
        profile.global_streak > 0 &&
        profile.last_checkin_date &&
        profile.last_checkin_date < yesterday
    ) {
        await supabase
            .from('profiles')
            .update({ global_streak: 0 })
            .eq('id', profile.id);

        return { ...profile, global_streak: 0 };
    }

    return profile;
}

// Write-on-read cleanup: resets current_streak to 0 for any goal where
// last_checkin_date is before yesterday (meaning the user missed a day).
// Returns the goals array with corrected streak values.
export async function resetStaleStreaks(
    supabase: SupabaseClient,
    goals: any[],
    today: string = todayInTimezone(),
): Promise<any[]> {
    const yesterday = dayBefore(today);

    const staleGoals = goals.filter(
        (g) => g.current_streak > 0 && g.last_checkin_date && g.last_checkin_date < yesterday
    );

    if (staleGoals.length === 0) return goals;

    // Reset all stale streaks in one batch update per goal
    // (Supabase JS doesn't support bulk update by ID list, so we use Promise.all)
    await Promise.all(
        staleGoals.map((g) =>
            supabase
                .from('goals')
                .update({ current_streak: 0 })
                .eq('id', g.id)
        )
    );

    // Return goals with corrected values
    return goals.map((g) =>
        staleGoals.some((s) => s.id === g.id)
            ? { ...g, current_streak: 0 }
            : g
    );
}
