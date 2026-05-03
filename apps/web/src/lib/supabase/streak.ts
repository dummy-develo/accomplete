import { SupabaseClient } from "@supabase/supabase-js";

// Returns today's date as YYYY-MM-DD
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

// Returns yesterday's date as YYYY-MM-DD
function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

// Pure computation — calculates new streak values when a check-in is scored.
// Called from scoreCheckin() so the returned values get written in the same goal update.
export function calculateGoalStreak(goal: {
    last_checkin_date: string | null;
    current_streak: number;
    best_streak: number;
}): { current_streak: number; best_streak: number } {
    const today = getToday();
    const yesterday = getYesterday();

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
export function calculateGlobalStreak(profile: {
    last_checkin_date: string | null;
    global_streak: number;
    highest_streak: number;
}): { global_streak: number; highest_streak: number; last_checkin_date: string } {
    const today = getToday();
    const yesterday = getYesterday();

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
): Promise<any> {
    const yesterday = getYesterday();

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
): Promise<any[]> {
    const yesterday = getYesterday();

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
