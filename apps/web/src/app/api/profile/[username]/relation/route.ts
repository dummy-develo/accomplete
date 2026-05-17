import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getProfileIdByUsername } from "@/lib/supabase/profiles";
import { getRelationState } from "@/lib/supabase/relations";

// Current viewer→target relation, so the profile page can render the
// follow/block buttons in the right state on load.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: target, error } = await getProfileIdByUsername(supabase, username);
    if (error || !target) {
        return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: state } = await getRelationState(supabase, userId, target.id);
    return Response.json({ state });
}
