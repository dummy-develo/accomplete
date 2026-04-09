import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { deleteCheckin } from "@/lib/supabase/checkins";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ checkinId: string }> }
) {
    const { checkinId } = await params;

    console.log('[log] POST delete checkin checkin_id=' + checkinId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: checkin, error } = await deleteCheckin(supabase, checkinId, userId);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ checkin });
}
