import { NextRequest } from "next/server";
import { getPublicProfile } from "@/lib/supabase/profiles";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    console.log('[log] GET public profile request for username=' + username);

    const supabase = await createClient();

    const { data: profile, error } = await getPublicProfile(supabase, username);

    if (error) {
        return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    return Response.json({ profile });
}
