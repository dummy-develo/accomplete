"use client"
// apps/web/src/app/page.tsx

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";



export default  function Home() {
  const supabase =  createClient();
  //const { data, error } = await supabase.auth.getSession();

  return (
    <div>
      <h1>Accomplete</h1>
      <br/><br/><br/>
      <CheckIfLoggedIn supabase={supabase} />
      <br/><br/><br/>
      <SignOut supabase={supabase}/>

    </div>
  );
}

function SignOut({supabase}:{supabase: SupabaseClient}){

  const router = useRouter();

  async function onSignOutClick(){
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      
      supabase.auth.signOut();
      
    }
    router.push('/login')
    
  }
  return(
    <Button onClick={onSignOutClick}>
      sign out
    </Button>
  )

}

function CheckIfLoggedIn({supabase}:{supabase: SupabaseClient}){

  async function check(){
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      
      alert(user?.email);
    } else {
      alert('NO USER!!');
    }
  }
  
  return(
    <Button onClick={check}>
      am I logged in?
    </Button>
  )
}