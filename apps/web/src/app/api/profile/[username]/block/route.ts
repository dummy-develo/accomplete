import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getProfileIdByUsername } from "@/lib/supabase/profiles";
import { getRelationState, setBlock } from "@/lib/supabase/relations";

// Resolves the authed viewer and the target user from the username.
async function resolve(
    request: NextRequest,
    username: string
) {
    const auth = await verifyUser(request);
    if (!auth) {
        return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    const { supabase, userId } = auth;

    const { data: target, error } = await getProfileIdByUsername(supabase, username);
    if (error || !target) {
        return { error: Response.json({ error: 'User not found' }, { status: 404 }) };
    }

    if (target.id === userId) {
        return { error: Response.json({ error: 'You cannot block yourself' }, { status: 400 }) };
    }

    return { supabase, userId, targetId: target.id };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;
    console.log('[log] POST block request for username=' + username);

    const r = await resolve(request, username);
    if ('error' in r) return r.error;
    const { supabase, userId, targetId } = r;

    // Blocking also clears the blocker's own follow on this row.
    const { error } = await setBlock(supabase, userId, targetId, true);
    if (error) {
        return Response.json({ error: error.message }, { status: 503 });
    }

    const { data: newState } = await getRelationState(supabase, userId, targetId);
    return Response.json({ state: newState });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;
    console.log('[log] DELETE block request for username=' + username);

    const r = await resolve(request, username);
    if ('error' in r) return r.error;
    const { supabase, userId, targetId } = r;

    const { error } = await setBlock(supabase, userId, targetId, false);
    if (error) {
        return Response.json({ error: error.message }, { status: 503 });
    }

    const { data: newState } = await getRelationState(supabase, userId, targetId);
    return Response.json({ state: newState });
}
