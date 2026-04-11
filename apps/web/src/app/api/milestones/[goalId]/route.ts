import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { getMilestonesByGoal, createMilestones } from "@/lib/supabase/milestones";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ goalId: string }> }
) {
    const { goalId } = await params;

    console.log('[log] GET milestones for goal_id=' + goalId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: milestones, error } = await getMilestonesByGoal(supabase, goalId, userId);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ milestones });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ goalId: string }> }
) {
    const { goalId } = await params;
    const body = await request.json();

    console.log('[log] POST create milestones for goal_id=' + goalId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    // Body: { milestones: [{ order_index, target_date, message?, checkin_score_at_creation? }, ...] }
    // Route attaches goal_id and user_id so the client doesn't have to.
    const rows = (body.milestones as Record<string, unknown>[]).map(m => ({
        ...m,
        goal_id: goalId,
        user_id: userId,
    }));

    const { data: milestones, error } = await createMilestones(supabase, rows);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ milestones }, { status: 201 });
}
