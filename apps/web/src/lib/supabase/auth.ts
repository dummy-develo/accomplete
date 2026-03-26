
import { NextRequest } from "next/server"
import { createClientFromToken, createClient } from "./server";

export async function verifyUser(
    request : NextRequest
){
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = token ? createClientFromToken(token) : await createClient();
    const { data: { user } , error } = await supabase.auth.getUser();

    if(error || !user){
        console.log(error);
        return null;
    }
    return { supabase, userId : user.id };
}