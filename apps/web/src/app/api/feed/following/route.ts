import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getPublicGoalsFeed, stripPrivateFields } from "@/lib/supabase/goals";
import { getBlockSet, getFollowingIds } from "@/lib/supabase/relations";
import { getProfilesByIds } from "@/lib/supabase/profiles";
import { parsePaging } from "@/lib/paging";

// Following feed: public goals from users the viewer follows, newest first,
// minus the viewer's block set (defensive — a block already clears the
// follow, but a stale reverse-direction block is filtered here too).
export async function GET(request: NextRequest) {
    console.log('[log] GET following feed request');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { limit, offset } = parsePaging(request);

    const { ids: followingIds, error: followError } = await getFollowingIds(supabase, userId);
    if (followError) {
        return Response.json({ error: 'Failed to load following list' }, { status: 503 });
    }
    if (followingIds.length === 0) {
        return Response.json({ goals: [], nextOffset: null });
    }

    const { ids: blockIds, error: blockError } = await getBlockSet(supabase, userId);
    if (blockError) {
        return Response.json({ error: 'Failed to load block set' }, { status: 503 });
    }

    const blocked = new Set(blockIds);
    const restrict = followingIds.filter((id) => !blocked.has(id));
    if (restrict.length === 0) {
        return Response.json({ goals: [], nextOffset: null });
    }

    const { data: goals, error } = await getPublicGoalsFeed(supabase, {
        restrictToUserIds: restrict,
        limit,
        offset,
    });
    if (error) {
        return Response.json({ error: error.message }, { status: 503 });
    }

    const rows = goals ?? [];

    const cleaned = rows.map((g) =>
        g.user_id === userId ? g : stripPrivateFields(g)
    );

    const authorIds = [...new Set(cleaned.map((g) => g.user_id))];
    const { data: profiles } = await getProfilesByIds(supabase, authorIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const withAuthors = cleaned.map((g) => ({
        ...g,
        author: byId.get(g.user_id) ?? null,
    }));

    const nextOffset = rows.length === limit ? offset + limit : null;
    return Response.json({ goals: withAuthors, nextOffset });
}
