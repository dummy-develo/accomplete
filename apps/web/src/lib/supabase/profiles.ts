import { SupabaseClient } from "@supabase/supabase-js";
import { resetStaleGlobalStreak } from "./streak";

const ALLOWED_UPDATE_FIELDS = [
    'username',
    'display_name',
    'avatar_url',
];

export async function getOwnProfile(
    supabase: SupabaseClient,
    userId: string
) {
    const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('is_deleted', false)
        .single();

    // Reset global streak if the user missed a day (write-on-read cleanup)
    if (result.data) {
        result.data = await resetStaleGlobalStreak(supabase, result.data);
    }

    return result;
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
    const result = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, total_score, global_streak, highest_streak, completed_goals_count, active_goals_count, dropped_goals_count, created_at, last_checkin_date')
        .eq('username', username)
        .eq('is_deleted', false)
        .single();

    // Reset global streak if the user missed a day (write-on-read cleanup)
    if (result.data) {
        result.data = await resetStaleGlobalStreak(supabase, result.data);
    }

    return result;
}

// Lightweight username → id lookup. Unlike getPublicProfile this returns
// only the id and skips the streak write-on-read, so follow/block/feed
// routes can resolve a target without touching the target's profile.
export async function getProfileIdByUsername(
    supabase: SupabaseClient,
    username: string
) {
    return await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .eq('is_deleted', false)
        .single();
}

// Batch fetch of public profile fields by id. Used to attach author info
// to feed goals in a single query (the codebase joins in app code rather
// than via embedded relational selects).
export async function getProfilesByIds(
    supabase: SupabaseClient,
    ids: string[]
) {
    if (ids.length === 0) {
        return { data: [], error: null };
    }
    return await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ids)
        .eq('is_deleted', false);
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
