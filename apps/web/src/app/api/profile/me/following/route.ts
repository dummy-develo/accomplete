import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getProfilesByIds } from "@/lib/supabase/profiles";
import { getBlockSet, getFollowingIds } from "@/lib/supabase/relations";

// Returns the list of profiles the authed viewer follows. Block set is
// stripped on both sides — if you blocked them or they blocked you, they
// drop off your following list. The viewer is allowed to see all rows
// where they are source_id, but the profile read for a blocked target
// could still succeed since profiles are publicly readable; filtering
// here keeps the Social page consistent with the rest of the UI.
export async function GET(request: NextRequest) {
    console.log('[log] GET own following list');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { ids: followingIds, error: followingError } = await getFollowingIds(
        supabase,
        userId,
    );
    if (followingError) {
        return Response.json({ error: 'Failed to load following' }, { status: 503 });
    }

    if (followingIds.length === 0) {
        return Response.json({ profiles: [] });
    }

    const { ids: blockedIds } = await getBlockSet(supabase, userId);
    const blocked = new Set(blockedIds);
    const visibleIds = followingIds.filter((id) => !blocked.has(id));

    if (visibleIds.length === 0) {
        return Response.json({ profiles: [] });
    }

    const { data: profiles, error: profilesError } = await getProfilesByIds(
        supabase,
        visibleIds,
    );
    if (profilesError) {
        return Response.json({ error: 'Failed to load profiles' }, { status: 503 });
    }

    return Response.json({ profiles });
}
