"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Signup(){
    

    return (
        <div>
            <br/><br/>
            <br/><br/><br/>
            <SignUpForm/>
            <br/><br/>
            <GotoSignInPage/>

        </div>
    )

}




function SignUpForm(){
    const supabase = createClient()
    const router = useRouter()
    const [error, setError] = useState("")

    return(
        <div className="bg-gray-300 p-5">
            <form onSubmit=
            
            
            {async (e) => {
                e.preventDefault()
                setError("")
                const form = e.target as HTMLFormElement
                const email = form.email.value
                const password = form.password.value
                console.log(email, password)


                const{error} = await supabase.auth.signUp({
                    email,
                    password
                })

                if (error) {
                    setError(error.message)
                } else {
                    router.push("/")
                }


            }}>
                <h1 className="text-2xl font-bold mb-4">Sign Up</h1>

                {error && <p className="text-red-500 mb-3">{error}</p>}

                <div className="mb-3">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
                </div>

                <div className="mb-3">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" />
                </div>

                <Button type="submit">Sign Up</Button>
            </form>
        </div>
    );


}


function GotoSignInPage(){
    const router = useRouter()

    function gotoLogin(){
        router.push('/login')
    }

    return(
        <Button onClick={gotoLogin}> Already have an account? Sign in bbg</Button>
    );
}
