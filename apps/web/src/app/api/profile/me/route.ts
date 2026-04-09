import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getOwnProfile, updateProfile } from "@/lib/supabase/profiles";

export async function GET(request: NextRequest) {
    console.log('[log] GET own profile request received');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: profile, error } = await getOwnProfile(supabase, userId);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ profile });
}

export async function PATCH(request: NextRequest) {
    console.log('[log] PATCH own profile request received');

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const body = await request.json();

    const { data: profile, error } = await updateProfile(supabase, userId, body);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ profile });
}
