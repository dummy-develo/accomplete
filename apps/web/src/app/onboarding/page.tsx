"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { handleBuildComplete } from "next/dist/build/adapter/build-complete";
import { SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
export default function Onboarding(){

    const supabase =  createClient();
    return (
        <div>
            <br/><br/>
            <br/><br/><br/>
            <OnboardingForm supabase={supabase}/>


        </div>
    )

}




function OnboardingForm({supabase}:{supabase: SupabaseClient}){

    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [message, setMessage] = useState('');
    const [displayname, SetDisplayname] = useState('');
    const router = useRouter();

    function updateUsername( updatedUserName : string){
        setUsername(updatedUserName);
    }

    function updateDisplayname( updatedDisplayname: string){
        SetDisplayname(updatedDisplayname);
    }

    async function checkUsername(){
        // need to add restrictions for username 
        // ie. no space or special char etc.


        if(username.length < 3){
            setMessage('username too short!');
            setIsAvailable(false);

        
        }
        else{
            const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            
            if(data) {
                setMessage('username unavailable');
                setIsAvailable(false);
            }
            else {
                setMessage('username Available');
                setIsAvailable(true);
            }
        }


    }

    async function pushOnboardingDetailsToDB(){
        



        const { data: { user } } = await supabase.auth.getUser();
        if(!user){
            router.push('/login');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                username: username,
                display_name: displayname,
            })
            .eq('id', user?.id)

        if(!error){
            router.push('/');
            return;
        }

    }

    return(
        <div className="ml-50 mr-50">
            <Label htmlFor="displayName"> Enter Display Name </Label>
            <Input
                id='displayName'
                type='text'
                value={displayname}
                onChange={e => updateDisplayname(e.target.value)}
                placeholder='Choose display name'
                />
            <br/><br/>
            <Label htmlFor="userName"> Enter Username </Label>
            
            <Input
                className={
                    isAvailable === null ? "" :
                    isAvailable ? "border-green-500" : "border-red-500"
                }
                id='userName'
                type='text'
                value={username}
                onChange={e => updateUsername(e.target.value)}
                placeholder='choose your username'
                />
            
            <Label className={isAvailable ? 'text-green-500' : 'text-red-500'}>{message}</Label>
            {/* {isAvailable === false || isAvailable === null && <p className="text-red-500 text-xs">{message}</p>}
            {isAvailable === true && <p className="text-green-500 text-xs">Username available</p>} */}
            <br/>
            <Button onClick={checkUsername}> is username available ? </Button>
            <br/>
            <Button disabled={!isAvailable}
            onClick={ e =>  pushOnboardingDetailsToDB()}
            suppressHydrationWarning>
                Save
            </Button>
        </div>
    );
}




function ValidateUsername({supabase}:{supabase: SupabaseClient}){
    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);


    useEffect(() => {
  if (!username || username.length < 3) {
    setIsAvailable(null)
    return
  }

  const timer = setTimeout(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    setIsAvailable(!data)
  }, 500)

  return () => clearTimeout(timer)
}, [username])
}

