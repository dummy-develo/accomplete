import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicGoalsByUserId, stripPrivateFields } from "@/lib/supabase/goals";
import { getRelationState } from "@/lib/supabase/relations";

// Returns public goals for a user, looked up by username.
// Owners see full data; non-owners get private fields stripped.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    const supabase = await createClient();

    // Look up the user's ID from their username
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .eq('is_deleted', false)
        .single();

    if (profileError || !profile) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if the requesting user is the profile owner. getClaims() verifies
    // the JWT locally (no Auth-server round-trip) with asymmetric signing keys;
    // the user id is the `sub` claim.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;
    const isOwner = userId === profile.id;

    // Standard-block: if the profile owner has blocked the viewer, they see
    // none of the owner's goals. (isBlockedByThem = owner → viewer row.)
    if (userId && !isOwner) {
        const { data: rel } = await getRelationState(supabase, userId, profile.id);
        if (rel.isBlockedByThem) {
            return Response.json({ goals: [] });
        }
    }

    const { data: goals, error } = await getPublicGoalsByUserId(
        supabase,
        profile.id,
        { skipUsernameFilter: isOwner }
    );

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    const result = isOwner
        ? (goals ?? [])
        : (goals ?? []).map(stripPrivateFields);

    return Response.json({ goals: result });
}
