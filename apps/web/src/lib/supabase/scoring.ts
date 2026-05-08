import { SupabaseClient } from "@supabase/supabase-js";
import { BASE_CHECKIN_VALUE, COMPLETION_MULTIPLIER } from "../constants";
import { calculateGoalStreak } from "./streak";

// Scores a check-in if the user hasn't already scored one today for this goal.
// Returns the points earned (either checkin_value or 0).
export async function scoreCheckin(
    supabase: SupabaseClient,
    goal: { id: string; user_id: string; checkin_value: number; score_checkin: number; last_checkin_date: string | null; current_streak: number; best_streak: number },
    checkinId: string,
) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Already scored a check-in today — this one gets 0
    if (goal.last_checkin_date === today) {
        return { pointsEarned: 0 };
    }

    const points = goal.checkin_value ?? BASE_CHECKIN_VALUE;
    const newScoreCheckin = (goal.score_checkin ?? 0) + points;

    // Calculate updated streak values
    const streak = calculateGoalStreak(goal);

    // Update the check-in row with actual points
    await supabase
        .from('checkins')
        .update({ points_earned: points })
        .eq('id', checkinId);

    // Update goal: bump score + set last_checkin_date + update streaks
    await supabase
        .from('goals')
        .update({
            score_checkin: newScoreCheckin,
            last_checkin_date: today,
            current_streak: streak.current_streak,
            best_streak: streak.best_streak,
        })
        .eq('id', goal.id);

    // Update profile total score
    await supabase.rpc('increment_profile_score', {
        user_id_input: goal.user_id,
        amount: points,
    }).then(({ error }) => {
        // Fallback if RPC doesn't exist — read-then-write
        if (error) {
            return supabase
                .from('profiles')
                .select('total_score')
                .eq('id', goal.user_id)
                .single()
                .then(({ data }) => {
                    const current = data?.total_score ?? 0;
                    return supabase
                        .from('profiles')
                        .update({ total_score: current + points })
                        .eq('id', goal.user_id);
                });
        }
    });

    return { pointsEarned: points };
}

// Checks for milestones that have reached their target_date and calculates
// their bonus. Returns the list of newly reached milestones so the frontend
// can show a celebration.
export async function scoreMilestoneReach(
    supabase: SupabaseClient,
    goal: { id: string; user_id: string; score_checkin: number; score_milestone: number },
) {
    const now = new Date().toISOString();

    // Find unreached milestones whose target_date has passed
    const { data: pendingMilestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('goal_id', goal.id)
        .is('reached_at', null)
        .lte('target_date', now);

    if (!pendingMilestones || pendingMilestones.length === 0) {
        return { reachedMilestones: [], totalBonus: 0 };
    }

    let totalBonus = 0;
    const reached = [];

    for (const milestone of pendingMilestones) {
        const bonus = (goal.score_checkin ?? 0) - (milestone.checkin_score_at_creation ?? 0);

        await supabase
            .from('milestones')
            .update({
                points_earned: bonus,
                reached_at: now,
            })
            .eq('id', milestone.id);

        totalBonus += bonus;
        reached.push({ ...milestone, points_earned: bonus, reached_at: now });
    }

    if (totalBonus > 0) {
        // Update goal milestone score
        const newScoreMilestone = (goal.score_milestone ?? 0) + totalBonus;
        await supabase
            .from('goals')
            .update({ score_milestone: newScoreMilestone })
            .eq('id', goal.id);

        // Update profile total score
        await supabase
            .from('profiles')
            .select('total_score')
            .eq('id', goal.user_id)
            .single()
            .then(({ data }) => {
                const current = data?.total_score ?? 0;
                return supabase
                    .from('profiles')
                    .update({ total_score: current + totalBonus })
                    .eq('id', goal.user_id);
            });
    }

    return { reachedMilestones: reached, totalBonus };
}

// Calculates and applies the 5× completion bonus.
// Called from completeGoal in goals.ts.
export async function scoreGoalCompletion(
    supabase: SupabaseClient,
    goal: { id: string; user_id: string; score_checkin: number; score_milestone: number },
) {
    const goalScore = (goal.score_checkin ?? 0) + (goal.score_milestone ?? 0);
    const bonus = COMPLETION_MULTIPLIER * goalScore;

    if (bonus > 0) {
        // Store completion bonus on the goal itself
        await supabase
            .from('goals')
            .update({ score_completion: bonus })
            .eq('id', goal.id);

        // Update profile total score with the bonus
        await supabase
            .from('profiles')
            .select('total_score')
            .eq('id', goal.user_id)
            .single()
            .then(({ data }) => {
                const current = data?.total_score ?? 0;
                return supabase
                    .from('profiles')
                    .update({ total_score: current + bonus })
                    .eq('id', goal.user_id);
            });
    }

    // Update profile goal counts
    await supabase
        .from('profiles')
        .select('completed_goals_count, active_goals_count')
        .eq('id', goal.user_id)
        .single()
        .then(({ data }) => {
            return supabase
                .from('profiles')
                .update({
                    completed_goals_count: (data?.completed_goals_count ?? 0) + 1,
                    active_goals_count: Math.max((data?.active_goals_count ?? 0) - 1, 0),
                })
                .eq('id', goal.user_id);
        });

    return { completionBonus: bonus };
}
