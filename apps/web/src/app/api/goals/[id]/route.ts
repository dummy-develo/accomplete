import { NextRequest } from "next/server"
import { getGoalById, updateGoal, reconcileMilestones } from "@/lib/supabase/goals";
import { verifyUser } from "@/lib/supabase/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

    const { id } = await params;

    console.log('[log] GET goal by id request recieved');
    const auth = await verifyUser(request);
    if(!auth){
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {supabase, userId} = auth;



    console.log('[log] User user_id = ' + userId + 'is fetching  goal id='+id);


    const {data : goal , error} = await getGoalById(supabase, id, userId);

    console.log('[log] fetch goal by id complete');

    if(error){
        return Response.json({ error }, { status: 503 });
    }


    return Response.json({ goal });
}

export async function PATCH(
    request : NextRequest,
    { params } :  { params : Promise<{ id: string}>}
) {

    const { id } = await params;
    const body = await request.json();

    console.log('[log] Patch goal by id request recieved');
    const auth = await verifyUser(request);
    if(!auth){
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {supabase, userId} = auth;


    // If target_completion_at is changing, fetch the goal before updating
    // so we can reconcile milestones based on the old vs new duration.
    let goalBeforeUpdate: Record<string, any> | null = null;
    if ('target_completion_at' in body) {
        const { data: existing } = await getGoalById(supabase, id, userId);
        goalBeforeUpdate = existing;
    }

    const {data : goal , error } = await updateGoal(supabase,id, userId, body);

    if(error){
        return Response.json({ error }, { status: 503 });
    }

    // Reconcile milestones when the target date changed
    if (goalBeforeUpdate && body.target_completion_at) {
        await reconcileMilestones(supabase, goalBeforeUpdate, body.target_completion_at as string);
    }

    return Response.json({ goal });

    
}






