import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getProfileIdByUsername } from "@/lib/supabase/profiles";
import { getRelationState, setFollow } from "@/lib/supabase/relations";

// Resolves the authed viewer and the target user from the username.
// Returns either an error Response or { supabase, userId, targetId }.
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
        return { error: Response.json({ error: 'You cannot follow yourself' }, { status: 400 }) };
    }

    return { supabase, userId, targetId: target.id };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;
    console.log('[log] POST follow request for username=' + username);

    const r = await resolve(request, username);
    if ('error' in r) return r.error;
    const { supabase, userId, targetId } = r;

    // A block in either direction prevents following.
    const { data: state } = await getRelationState(supabase, userId, targetId);
    if (state.isBlockedByMe || state.isBlockedByThem) {
        return Response.json(
            { error: 'Cannot follow while a block is in place' },
            { status: 403 }
        );
    }

    const { error } = await setFollow(supabase, userId, targetId, true);
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
    console.log('[log] DELETE follow request for username=' + username);

    const r = await resolve(request, username);
    if ('error' in r) return r.error;
    const { supabase, userId, targetId } = r;

    const { error } = await setFollow(supabase, userId, targetId, false);
    if (error) {
        return Response.json({ error: error.message }, { status: 503 });
    }

    const { data: newState } = await getRelationState(supabase, userId, targetId);
    return Response.json({ state: newState });
}
