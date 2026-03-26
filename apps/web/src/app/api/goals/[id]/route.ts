import { NextRequest } from "next/server"
import { getGoalById, updateGoal } from "@/lib/supabase/goals";
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


    const {data : goal , error} = await getGoalById(supabase,id, userId);

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


    const {data : goal , error } = await updateGoal(supabase,id, userId, body);

    if(error){
        return Response.json({ error }, { status: 503 });
    }


    return Response.json({ goal });

    
}






