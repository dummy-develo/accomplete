import { SupabaseClient } from "@supabase/supabase-js";
import { scoreCheckin, scoreMilestoneReach } from "./scoring";
import { calculateGlobalStreak } from "./streak";

export async function getCheckinsByGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    return await supabase
        .from('checkins')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
}

export async function createCheckin(
    supabase: SupabaseClient,
    goalId: string,
    userId: string,
    body: Record<string, unknown>
) {
    // Fetch goal with all fields needed for scoring
    const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('id, user_id, checkin_value, score_checkin, score_milestone, last_checkin_date, current_streak, best_streak, status, is_deleted')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('is_deleted', false)
        .single();

    if (goalError || !goal) {
        return { data: null, error: { message: 'Goal not found or not active' } };
    }

    // Insert the check-in with 0 points initially — scoring updates it if earned
    const { data: checkin, error: checkinError } = await supabase
        .from('checkins')
        .insert({
            goal_id: goalId,
            user_id: userId,
            metric_value: body.metric_value,
            notes: body.notes,
            points_earned: 0,
        })
        .select()
        .single();

    if (checkinError || !checkin) {
        return { data: null, error: checkinError };
    }

    // Score the check-in (10 pts if first of the day, 0 otherwise)
    const { pointsEarned } = await scoreCheckin(supabase, goal, checkin.id);

    // Update global streak on the profile (at least one check-in today = streak continues)
    if (pointsEarned > 0) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, last_checkin_date, global_streak, highest_streak')
            .eq('id', userId)
            .single();

        if (profile) {
            const streakUpdate = calculateGlobalStreak(profile);
            await supabase
                .from('profiles')
                .update(streakUpdate)
                .eq('id', userId);
        }
    }

    // Check for milestones that have reached their target_date
    const { reachedMilestones } = await scoreMilestoneReach(supabase, goal);

    // Return the check-in with its actual points and any reached milestones
    return {
        data: { ...checkin, points_earned: pointsEarned },
        error: null,
        reachedMilestones,
    };
}

export async function deleteCheckin(
    supabase: SupabaseClient,
    checkinId: string,
    userId: string
) {
    // Soft delete only — points are permanent
    // is_deleted = true, but points_earned stays in the row
    // No recalculation of scores or streaks

    return await supabase
        .from('checkins')
        .update({ is_deleted: true })
        .eq('id', checkinId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .select()
        .single();
}
