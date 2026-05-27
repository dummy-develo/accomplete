import { createGoal, getGoalsByUser } from "@/lib/supabase/goals";
import { NextRequest } from "next/server"
import { verifyUser } from "@/lib/supabase/auth"



export async function GET(request: NextRequest) {

    const status = request.nextUrl.searchParams.get('status');

    console.log('GET request recieved');
    const auth = await verifyUser(request);
    if(!auth){
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {supabase, userId} = auth;
    console.log('User user_id = ' + userId + 'is fetching all goals')

    const {data : goals , error} = await getGoalsByUser(supabase, userId, status)
    console.log('all goals data fetch complete');

    if(error){
        return Response.json({ error }, { status: 503 });
    }


    return Response.json({ goals });
}




export async function POST(request: NextRequest) {
    const body = await request.json();
    
    const auth = await verifyUser(request);
    if(!auth){
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {supabase, userId} = auth;

    console.log('User user_id = ' + userId + 'is creating new goal')

    const { data  , error} = await createGoal(supabase,userId,body);
    
    if (error || !data) {                                                                                                                                      
        return Response.json({ error }, { status: 400 });
    }
    return Response.json( {  data });
}



function validateStatus(status : string){


}