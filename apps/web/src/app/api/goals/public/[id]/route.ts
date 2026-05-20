import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getPublicGoalById, stripPrivateFields } from "@/lib/supabase/goals";
import { getRelationState } from "@/lib/supabase/relations";
import { getProfilesByIds } from "@/lib/supabase/profiles";

// Composite read for the public goal-detail page: fetches goal, milestones,
// checkins, and author in one round trip. The existing milestone/checkin
// helpers are owner-scoped (filter by user_id), so this route reads the
// child tables directly — RLS already restricts them to public goals
// (milestones: any public goal; checkins: only if are_checkins_public).
//
// Block enforcement is application-level (RLS doesn't see blocks): 404 if
// the viewer blocked the owner OR vice versa, indistinguishable from a
// missing goal on purpose.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    console.log('[log] GET public goal id=' + id);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: goal, error } = await getPublicGoalById(supabase, id);
    if (error || !goal) {
        return Response.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Block check — surface as 404 so blocked users can't probe existence.
    if (goal.user_id !== userId) {
        const { data: rel } = await getRelationState(supabase, userId, goal.user_id);
        if (rel.isBlockedByMe || rel.isBlockedByThem) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }
    }

    const isOwner = goal.user_id === userId;
    const cleanedGoal = isOwner ? goal : stripPrivateFields(goal);

    // Milestones are visible on any public goal (RLS policy
    // "Public goal milestones are viewable").
    const { data: milestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('goal_id', id)
        .order('order_index', { ascending: true });

    // Checkins: RLS only returns rows for goals with are_checkins_public.
    // We also gate explicitly so we don't even round-trip when the toggle
    // is off, and so the response shape is unambiguous to the client.
    let checkins: any[] = [];
    if (isOwner || goal.are_checkins_public) {
        const { data } = await supabase
            .from('checkins')
            .select('*')
            .eq('goal_id', id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        checkins = data ?? [];
    }

    // Author — username may be private; null it out so the page renders
    // without revealing identity.
    let author: { username: string; display_name: string | null; avatar_url: string | null } | null = null;
    if (isOwner || goal.is_username_public) {
        const { data: profiles } = await getProfilesByIds(supabase, [goal.user_id]);
        author = profiles?.[0] ?? null;
    }

    return Response.json({
        goal: cleanedGoal,
        milestones: milestones ?? [],
        checkins,
        author,
    });
}
