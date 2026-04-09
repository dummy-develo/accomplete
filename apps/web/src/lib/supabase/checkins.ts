import { SupabaseClient } from "@supabase/supabase-js";

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
    // Verify goal belongs to user and is active
    const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('id, checkin_value')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('is_deleted', false)
        .single();

    if (goalError || !goal) {
        return { data: null, error: { message: 'Goal not found or not active' } };
    }

    // TODO: Scoring logic
    // 1. Fetch the goal's checkin_value (already fetched above in `goal`)
    // 2. Set points_earned = checkin_value
    // 3. Update goals.score_checkin (add points_earned)
    // 4. Update profiles.total_score (add points_earned)
    //
    // TODO: Streak logic
    // 1. Check if this checkin is on time (based on checkin_frequency)
    // 2. If on time: increment goals.current_streak, update goals.best_streak if needed
    // 3. Update profiles.global_streak and profiles.highest_streak
    //
    // TODO: Milestone check
    // 1. Check if any milestone target_date has been reached
    // 2. If so, calculate milestone bonus and update milestone.points_earned
    // 3. Update goals.score_milestone

    const newCheckin = {
        goal_id: goalId,
        user_id: userId,
        metric_value: body.metric_value,
        notes: body.notes,
        points_earned: 0, // TODO: replace with checkin_value from goal
    };

    return await supabase
        .from('checkins')
        .insert(newCheckin)
        .select()
        .single();
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
