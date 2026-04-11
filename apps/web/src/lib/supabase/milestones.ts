import { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_UPDATE_FIELDS = ['message'];

export async function getMilestonesByGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    return await supabase
        .from('milestones')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', userId)
        .order('order_index', { ascending: true });
}

export async function createMilestones(
    supabase: SupabaseClient,
    rows: Record<string, unknown>[]
) {
    return await supabase
        .from('milestones')
        .insert(rows)
        .select();
}

export async function updateMilestone(
    supabase: SupabaseClient,
    milestoneId: string,
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
        .from('milestones')
        .update(updates)
        .eq('id', milestoneId)
        .eq('user_id', userId)
        .select()
        .single();
}
