import { SupabaseClient } from "@supabase/supabase-js";

// The `relations` table holds one directed row per (source_id, destination_id)
// pair, carrying both is_following and is_blocked. RLS lets a user write only
// rows where they are source_id, and read rows where they are source OR
// destination. Effective ("true") blocked status is never stored — it is
// derived at read time from both directional rows (see getBlockSet).

// Returns the set of user ids the given user cannot see / be seen by:
// everyone they blocked, plus everyone who blocked them. Two RLS-legal
// reads, unioned. This is fetched once per feed/profile request and is
// bounded by the viewer's own block count, not the feed size.
export async function getBlockSet(
    supabase: SupabaseClient,
    userId: string
): Promise<{ ids: string[]; error: unknown }> {
    const { data: iBlocked, error: e1 } = await supabase
        .from('relations')
        .select('destination_id')
        .eq('source_id', userId)
        .eq('is_blocked', true);

    const { data: blockedMe, error: e2 } = await supabase
        .from('relations')
        .select('source_id')
        .eq('destination_id', userId)
        .eq('is_blocked', true);

    if (e1 || e2) {
        return { ids: [], error: e1 ?? e2 };
    }

    const ids = new Set<string>();
    for (const r of iBlocked ?? []) ids.add(r.destination_id);
    for (const r of blockedMe ?? []) ids.add(r.source_id);

    return { ids: [...ids], error: null };
}

// Relationship of viewer toward target, for rendering follow/block controls.
// isBlockedByThem comes from the reverse row, which the viewer is allowed to
// read because they are its destination_id.
export async function getRelationState(
    supabase: SupabaseClient,
    viewerId: string,
    targetId: string
) {
    const { data: forward } = await supabase
        .from('relations')
        .select('is_following, is_blocked')
        .eq('source_id', viewerId)
        .eq('destination_id', targetId)
        .maybeSingle();

    const { data: reverse } = await supabase
        .from('relations')
        .select('is_blocked')
        .eq('source_id', targetId)
        .eq('destination_id', viewerId)
        .maybeSingle();

    return {
        data: {
            isFollowing: forward?.is_following ?? false,
            isBlockedByMe: forward?.is_blocked ?? false,
            isBlockedByThem: reverse?.is_blocked ?? false,
        },
        error: null,
    };
}

// Upserts the (source → dest) row, setting only is_following. The upsert
// conflicts on the (source_id, destination_id) unique constraint, so an
// existing is_blocked value on that row is preserved.
export async function setFollow(
    supabase: SupabaseClient,
    sourceId: string,
    destId: string,
    value: boolean
) {
    return await supabase
        .from('relations')
        .upsert(
            { source_id: sourceId, destination_id: destId, is_following: value },
            { onConflict: 'source_id,destination_id' }
        )
        .select()
        .single();
}

// Upserts the (source → dest) row. Blocking also clears the blocker's own
// follow on that row (you don't follow someone you block). Unblocking does
// not auto-restore the follow — the user must follow again.
export async function setBlock(
    supabase: SupabaseClient,
    sourceId: string,
    destId: string,
    value: boolean
) {
    const payload = value
        ? { source_id: sourceId, destination_id: destId, is_blocked: true, is_following: false }
        : { source_id: sourceId, destination_id: destId, is_blocked: false };

    return await supabase
        .from('relations')
        .upsert(payload, { onConflict: 'source_id,destination_id' })
        .select()
        .single();
}

// Ids of users the given user follows. Used to scope the following feed.
export async function getFollowingIds(
    supabase: SupabaseClient,
    userId: string
): Promise<{ ids: string[]; error: unknown }> {
    const { data, error } = await supabase
        .from('relations')
        .select('destination_id')
        .eq('source_id', userId)
        .eq('is_following', true);

    if (error) {
        return { ids: [], error };
    }

    return { ids: (data ?? []).map((r) => r.destination_id), error: null };
}

// Follower / following counts computed on the fly (no cached columns).
export async function getFollowCounts(
    supabase: SupabaseClient,
    userId: string
) {
    const { count: followers } = await supabase
        .from('relations')
        .select('*', { count: 'exact', head: true })
        .eq('destination_id', userId)
        .eq('is_following', true);

    const { count: following } = await supabase
        .from('relations')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', userId)
        .eq('is_following', true);

    return {
        data: { followers: followers ?? 0, following: following ?? 0 },
        error: null,
    };
}
