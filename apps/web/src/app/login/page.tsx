"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginIn(){
    
    return (
        <div>
            <h1>log in with email/password</h1>
            <br/><br/><br/>
            <LoginForm/>
            <br/><br/><br/>
            <GotoSignUpButton/>

            
        </div>
    )

}

function GotoSignUpButton(){
    const router = useRouter()

    function gotoSignUp(){
        router.push('/signup')
    }

    return(
        <Button onClick={gotoSignUp}> Don't Have account? Sign up baby</Button>
    );
}



function LoginForm(){
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
    


                const{error} = await supabase.auth.signInWithPassword({
                    email,
                    password
                })

                if (error) {
                    setError(error.message)
                } else {
                    router.push("/")
                }


            }}>
                <h1 className="text-2xl font-bold mb-4">Login</h1>

                {error && <p className="text-red-500 mb-3">{error}</p>}

                <div className="mb-3">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
                </div>

                <div className="mb-3">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" />
                </div>

                <Button type="submit">Login</Button>
            </form>
        </div>
    );


}