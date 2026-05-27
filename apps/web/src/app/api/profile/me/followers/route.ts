import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getProfilesByIds } from "@/lib/supabase/profiles";
import {
    getBlockSet,
    getFollowerIds,
    getFollowingIds,
} from "@/lib/supabase/relations";

// Returns the list of profiles that follow the authed viewer. Each row
// carries isFollowingBack so the UI can render a "Follow back" CTA when
// the relation is asymmetric. Block set is stripped both directions.
export async function GET(request: NextRequest) {
    console.log('[log] GET own followers list');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { ids: followerIds, error: followerError } = await getFollowerIds(
        supabase,
        userId,
    );
    if (followerError) {
        return Response.json({ error: 'Failed to load followers' }, { status: 503 });
    }

    if (followerIds.length === 0) {
        return Response.json({ profiles: [] });
    }

    const { ids: blockedIds } = await getBlockSet(supabase, userId);
    const blocked = new Set(blockedIds);
    const visibleIds = followerIds.filter((id) => !blocked.has(id));

    if (visibleIds.length === 0) {
        return Response.json({ profiles: [] });
    }

    // Followed-back set lets the UI mark each row without an extra round trip.
    const { ids: followingIds } = await getFollowingIds(supabase, userId);
    const followingBack = new Set(followingIds);

    const { data: rawProfiles, error: profilesError } = await getProfilesByIds(
        supabase,
        visibleIds,
    );
    if (profilesError) {
        return Response.json({ error: 'Failed to load profiles' }, { status: 503 });
    }

    const profiles = (rawProfiles ?? []).map((p) => ({
        ...p,
        isFollowingBack: followingBack.has(p.id),
    }));

    return Response.json({ profiles });
}
