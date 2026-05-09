import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicGoalsByUserId, stripPrivateFields } from "@/lib/supabase/goals";

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

    // Check if the requesting user is the profile owner
    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user?.id === profile.id;

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
