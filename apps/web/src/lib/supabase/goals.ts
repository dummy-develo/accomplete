import { SupabaseClient } from "@supabase/supabase-js";

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

    return await query;
}



export async function getGoalById(supabase: SupabaseClient
    , goalId: string, 
    userId: string
) {
    return await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();
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
        checkin_frequency: body.checkin_frequency,
        days_between_checkins: body.days_between_checkins,
        target_completion_at: body.target_completion_at,
        completion_message: body.completion_message,
        is_public: body.is_public,
    };

    return await supabase
        .from('goals')
        .insert(newGoal)
        .select()
        .single();
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
    return await supabase
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
}

export async function completeGoal(
    supabase: SupabaseClient, 
    goalId: string, 
    userId: string
) {
    // TODO: Calculate 5× completion bonus
    // 1. Fetch goal's score_checkin and score_milestone
    // 2. completionBonus = 5 * (score_checkin + score_milestone)
    // 3. Update goal status to 'completed', set completed_at
    // 4. Add completionBonus to goal scores
    // 5. Update profile's total_score with the bonus
    // 6. Update profile's completed_goals_count (+1) and active_goals_count (-1)

    return await supabase
        .from('goals')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();
}
