import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getPublicGoalsFeed, stripPrivateFields } from "@/lib/supabase/goals";
import { getBlockSet } from "@/lib/supabase/relations";
import { getProfilesByIds } from "@/lib/supabase/profiles";
import { parsePaging } from "@/lib/paging";

// Global feed: every public goal, newest first, minus anything in the
// viewer's block set (people they blocked or who blocked them).
export async function GET(request: NextRequest) {
    console.log('[log] GET global feed request');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { limit, offset } = parsePaging(request);

    const { ids: blockIds, error: blockError } = await getBlockSet(supabase, userId);
    if (blockError) {
        return Response.json({ error: 'Failed to load block set' }, { status: 503 });
    }

    const { data: goals, error } = await getPublicGoalsFeed(supabase, {
        excludeUserIds: blockIds,
        limit,
        offset,
    });
    if (error) {
        return Response.json({ error: error.message }, { status: 503 });
    }

    const rows = goals ?? [];

    // Strip private fields for everyone except the viewer's own goals.
    const cleaned = rows.map((g) =>
        g.user_id === userId ? g : stripPrivateFields(g)
    );

    // Attach author info in a single batched query.
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
