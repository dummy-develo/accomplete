import { SupabaseClient } from "@supabase/supabase-js";
import { createMilestones } from "./milestones";
import { scoreGoalCompletion } from "./scoring";
import { resetStaleStreaks } from "./streak";
import { BASE_CHECKIN_VALUE, getMilestoneCount } from "../constants";

const ALLOWED_UPDATE_FIELDS = [
    'goal_name', 'goal_description', 'goal_type',
    'benchmark_name', 'benchmark_target_value',
    'target_completion_at', 'completion_message',
    'is_public', 'is_goal_name_public', 'is_username_public',
    'is_description_public', 'is_goal_type_public',
    'are_checkins_public', 'is_benchmark_name_public',
    'is_deleted',
];

const ALLOWED_STATUS_VALUES = [
    'dropped',
    'completed',
    'active',
];

export async function getGoalsByUser(
    supabase: SupabaseClient, 
    userId: string,
    status: string | null
) {
    if (status && !ALLOWED_STATUS_VALUES.includes(status)) {
        return { data: null, error: { message: 'Invalid status value' } };
    }

    let query = supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

    if (status) {
        query = query.eq('status', status);
    }

    const result = await query;

    // Reset streaks for goals where the user missed a day (write-on-read cleanup)
    if (result.data) {
        result.data = await resetStaleStreaks(supabase, result.data);
    }

    return result;
}



export async function getGoalById(supabase: SupabaseClient
    , goalId: string,
    userId: string
) {
    const result = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

    // Reset streak if the user missed a day (write-on-read cleanup)
    if (result.data) {
        const [corrected] = await resetStaleStreaks(supabase, [result.data]);
        result.data = corrected;
    }

    return result;
}

export async function createGoal(supabase: SupabaseClient,
    userId: string,
    body: Record<string, unknown>
) {
    const newGoal = {
        user_id: userId,
        goal_name: body.goal_name,
        goal_description: body.goal_description,
        goal_type: body.goal_type,
        benchmark_name: body.benchmark_name,
        benchmark_target_value: body.benchmark_target_value,
        checkin_frequency: body.checkin_frequency ?? 'daily',
        days_between_checkins: body.days_between_checkins ?? 1,
        checkin_value: BASE_CHECKIN_VALUE,
        target_completion_at: body.target_completion_at,
        completion_message: body.completion_message,
        is_public: body.is_public,
    };

    // Insert the goal row
    const { data: goal, error: goalError } = await supabase
        .from('goals')
        .insert(newGoal)
        .select()
        .single();

    if (goalError || !goal) {
        return { data: null, error: goalError };
    }

    // Auto-generate milestones based on goal duration
    const milestoneRows = generateMilestoneRows(goal.id, userId, goal.target_completion_at, goal.created_at);
    const milestoneCount = milestoneRows.length;

    if (milestoneCount > 0) {
        const { error: msError } = await createMilestones(supabase, milestoneRows);

        if (msError) {
            // Milestone creation failed — delete the goal to avoid partial state
            await supabase.from('goals').delete().eq('id', goal.id);
            return { data: null, error: { message: 'Failed to create milestones' } };
        }

        // Store the count on the goal row
        await supabase
            .from('goals')
            .update({ total_milestones: milestoneCount })
            .eq('id', goal.id);
    }

    // Increment active_goals_count on the profile
    await supabase
        .from('profiles')
        .select('active_goals_count')
        .eq('id', userId)
        .single()
        .then(({ data }) => {
            return supabase
                .from('profiles')
                .update({
                    active_goals_count: (data?.active_goals_count ?? 0) + 1,
                })
                .eq('id', userId);
        });

    return { data: { ...goal, total_milestones: milestoneCount }, error: null };
}

// Builds milestone row objects evenly spaced across the goal timeline.
// Each milestone lands at i/(N+1) of the way through, so the last one
// is always before the goal's end date, never coinciding with it.
// All target_dates are set to midnight UTC for clean display.
function generateMilestoneRows(
    goalId: string,
    userId: string,
    targetCompletionAt: string,
    createdAt: string,
) {
    const start = new Date(createdAt);
    const end = new Date(targetCompletionAt);
    const durationMs = end.getTime() - start.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    if (durationDays <= 0) return [];

    const count = getMilestoneCount(durationDays);
    const rows = [];

    for (let i = 1; i <= count; i++) {
        // Place at i/(count+1) of the timeline
        const fraction = i / (count + 1);
        const targetDate = new Date(start.getTime() + durationMs * fraction);

        // Snap to midnight UTC
        targetDate.setUTCHours(0, 0, 0, 0);

        rows.push({
            goal_id: goalId,
            user_id: userId,
            order_index: i,
            target_date: targetDate.toISOString(),
            checkin_score_at_creation: 0,
            points_earned: 0,
        });
    }

    return rows;
}

// Fetches public, non-deleted goals for any user (used on profile pages).
// No streak reset here — this is a read-only view for other users.
export async function getPublicGoalsByUserId(
    supabase: SupabaseClient,
    userId: string
) {
    return await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
}

export async function updateGoal(
    supabase: SupabaseClient, 
    goalId: string, 
    userId: string, 
    body: Record<string, unknown>
) {
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in body) {
            updates[field] = body[field];
        }
    }

    if (Object.keys(updates).length !== Object.keys(body).length) {
        return { data: null, error: { message: 'Invalid input' } };
    }

    return await supabase
        .from('goals')
        .update(updates)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
}

export async function dropGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    const result = await supabase
        .from('goals')
        .update({
            status: 'dropped',
            current_streak: 0,
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

    // Update profile goal counts: active -1, dropped +1
    if (result.data) {
        await supabase
            .from('profiles')
            .select('active_goals_count, dropped_goals_count')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
                return supabase
                    .from('profiles')
                    .update({
                        active_goals_count: Math.max((data?.active_goals_count ?? 0) - 1, 0),
                        dropped_goals_count: (data?.dropped_goals_count ?? 0) + 1,
                    })
                    .eq('id', userId);
            });
    }

    return result;
}

export async function completeGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    // Fetch the goal to get scores for the completion bonus
    const { data: goal, error: fetchError } = await supabase
        .from('goals')
        .select('id, user_id, score_checkin, score_milestone')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    if (fetchError || !goal) {
        return { data: null, error: { message: 'Goal not found or not active' } };
    }

    // Mark the goal as completed
    const { data: updated, error: updateError } = await supabase
        .from('goals')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', goalId)
        .select()
        .single();

    if (updateError) {
        return { data: null, error: updateError };
    }

    // Apply 5× completion bonus to profile score + update goal counts
    const { completionBonus } = await scoreGoalCompletion(supabase, goal);

    return { data: { ...updated, completion_bonus: completionBonus }, error: null };
}
