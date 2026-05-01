import { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_UPDATE_FIELDS = [
    'username',
    'display_name',
    'avatar_url',
];

export async function getOwnProfile(
    supabase: SupabaseClient,
    userId: string
) {
    return await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('is_deleted', false)
        .single();
}

export async function updateProfile(
    supabase: SupabaseClient,
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
        return { data: null, error: { message: 'Request contains invalid fields' } };
    }

    if (Object.keys(updates).length === 0) {
        return { data: null, error: { message: 'No valid fields to update' } };
    }

    return await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
}

export async function getPublicProfile(
    supabase: SupabaseClient,
    username: string
) {
    return await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, total_score, global_streak, highest_streak, completed_goals_count, active_goals_count, dropped_goals_count, created_at')
        .eq('username', username)
        .eq('is_deleted', false)
        .single();
}

// Search profiles by username or display_name (case-insensitive partial match)
export async function searchProfiles(
    supabase: SupabaseClient,
    query: string,
    limit: number = 10
) {
    return await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('is_deleted', false)
        .not('username', 'is', null)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);
}

// Internal only — no API endpoint. Called by scoring/goal logic.
export async function updateProfileStats(
    supabase: SupabaseClient,
    userId: string,
    stats: {
        total_score?: number;
        global_streak?: number;
        highest_streak?: number;
        completed_goals_count?: number;
        active_goals_count?: number;
        dropped_goals_count?: number;
    }
) {
    return await supabase
        .from('profiles')
        .update(stats)
        .eq('id', userId)
        .select()
        .single();
}
