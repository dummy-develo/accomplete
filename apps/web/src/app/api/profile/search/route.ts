import { NextRequest } from "next/server";
import { searchProfiles } from "@/lib/supabase/profiles";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('q')?.trim();

    if (!query || query.length < 2 || query.length > 50) {
        return Response.json({ error: 'Query must be 2–50 characters' }, { status: 400 });
    }

    console.log('[log] GET profile search request for q=' + query);

    const supabase = await createClient();

    const { data: profiles, error } = await searchProfiles(supabase, query);

    if (error) {
        return Response.json({ error: 'Search failed' }, { status: 500 });
    }

    return Response.json({ profiles });
}
