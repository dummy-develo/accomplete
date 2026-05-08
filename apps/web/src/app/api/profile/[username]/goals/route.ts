import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicGoalsByUserId } from "@/lib/supabase/goals";

// Returns public goals for a user, looked up by username.
// No auth required — these are public goals.
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

    const { data: goals, error } = await getPublicGoalsByUserId(supabase, profile.id);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ goals: goals ?? [] });
}
