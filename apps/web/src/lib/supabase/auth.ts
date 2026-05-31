
import { NextRequest } from "next/server"
import { createClientFromToken, createClient } from "./server";

export async function verifyUser(
    request : NextRequest
){
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = token ? createClientFromToken(token) : await createClient();
    // getClaims() verifies the JWT signature locally (no network round-trip to
    // the Auth server) once the project uses asymmetric JWT signing keys. The
    // user id lives in the `sub` claim. Mirrors what proxy.ts already does.
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;

    if(error || !claims){
        console.log(error);
        return null;
    }
    return { supabase, userId : claims.sub };
}