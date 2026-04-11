import { NextRequest } from "next/server";
import { verifyUser } from "@/lib/supabase/auth";
import { updateMilestone } from "@/lib/supabase/milestones";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ milestoneId: string }> }
) {
    const { milestoneId } = await params;
    const body = await request.json();

    console.log('[log] PATCH milestone milestone_id=' + milestoneId);

    const auth = await verifyUser(request);
    if (!auth) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { supabase, userId } = auth;

    const { data: milestone, error } = await updateMilestone(supabase, milestoneId, userId, body);

    if (error) {
        return Response.json({ error }, { status: 400 });
    }

    return Response.json({ milestone });
}
