import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getCheckinsByGoal, createCheckin } from "@/lib/supabase/checkins";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ goalId: string }> }
) {
    const { goalId } = await params;

    console.log('[log] GET checkins for goal_id=' + goalId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: checkins, error } = await getCheckinsByGoal(supabase, goalId, userId);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ checkins });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ goalId: string }> }
) {
    const { goalId } = await params;
    const body = await request.json();

    console.log('[log] POST new checkin for goal_id=' + goalId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: checkin, error } = await createCheckin(supabase, goalId, userId, body);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ checkin }, { status: 201 });
}
