import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import {
    getPublicGoalsFeed,
    stripPrivateFields,
    FEED_SORT_COLUMNS,
    FEED_STATUSES,
    type FeedSort,
    type FeedStatus,
} from "@/lib/supabase/goals";
import { getBlockSet } from "@/lib/supabase/relations";
import { getProfilesByIds } from "@/lib/supabase/profiles";
import { parsePaging } from "@/lib/paging";

// Global feed: every public goal, minus anything in the viewer's block
// set (people they blocked or who blocked them). Sortable via ?sort and
// filterable via ?status; both fall back to defaults on an unknown value
// (a feed shouldn't hard-fail on a bad query param).
export async function GET(request: NextRequest) {
    console.log('[log] GET global feed request');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { limit, offset } = parsePaging(request);

    const sp = request.nextUrl.searchParams;
    const sortParam = sp.get('sort') ?? '';
    const sort: FeedSort =
        sortParam in FEED_SORT_COLUMNS ? (sortParam as FeedSort) : 'newest';
    const statusParam = sp.get('status') ?? '';
    const status: FeedStatus = (FEED_STATUSES as readonly string[]).includes(
        statusParam
    )
        ? (statusParam as FeedStatus)
        : 'active';

    const { ids: blockIds, error: blockError } = await getBlockSet(supabase, userId);
    if (blockError) {
        return Response.json({ error: 'Failed to load block set' }, { status: 503 });
    }

    const { data: goals, error } = await getPublicGoalsFeed(supabase, {
        excludeUserIds: blockIds,
        sort,
        status,
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
