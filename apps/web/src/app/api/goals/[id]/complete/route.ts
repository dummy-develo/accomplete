import { completeGoal } from "@/lib/supabase/goals";
import { createClientFromToken, createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { verifyUser } from "@/lib/supabase/auth"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    
    const auth = await verifyUser(request);
    if(!auth){
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {supabase, userId} = auth;

    console.log('[log] User user_id = ' + userId + 'has completed goal goal_id = '+ id);


    const { data  , error} = await completeGoal(supabase,id, userId );

    
    if (error || !data) {                                                                                                                                      
        return Response.json({ error }, { status: 400 });
    }
    return Response.json( {  data });
}