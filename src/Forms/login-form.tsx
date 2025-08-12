// components/login-form.tsx
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { GoogleLogin, CredentialResponse } from "@react-oauth/google"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useGoogleLogin } from "@react-oauth/google";

// export default function GoogleSignInButton({ navigate, from, toast, signInWithGoogleToken }) {
//     const googleLogin = useGoogleLogin({
//         onSuccess: async (tokenResponse) => {
//             try {
//                 // exchange access_token for ID token from Google API
//                 const userInfo = await fetch(
//                     "https://www.googleapis.com/oauth2/v3/userinfo",
//                     {
//                         headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
//                     }
//                 ).then(res => res.json());

//                 // Call your backend with ID token or access token
//                 await signInWithGoogleToken(tokenResponse.access_token);

//                 toast({ title: "Signed in", description: `Welcome back, ${userInfo.name}!` });
//                 navigate(from, { replace: true });
//             } catch (e: any) {
//                 toast({
//                     title: "Sign in failed",
//                     description: e?.message || "Please try again.",
//                     variant: "destructive",
//                 });
//             }
//         },
//         onError: () => {
//             toast({
//                 title: "Google Sign-In failed",
//                 description: "Try again later.",
//                 variant: "destructive",
//             });
//         },
//     });

//     return (
//         <Button
//             variant="outline"
//             className="flex items-center gap-3 px-4 py-2"
//             onClick={() => googleLogin()}
//         >
//             <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 viewBox="0 0 24 24"
//                 width="20"
//                 height="20"
//             >
//                 <path
//                     fill="#4285F4"
//                     d="M23.49 12.27c0-.85-.07-1.47-.22-2.11H12.24v3.83h6.46c-.13 1.02-.83 2.57-2.38 3.61l-.02.11 3.46 2.68.24.02c2.21-2.04 3.49-5.04 3.49-8.14z"
//                 />
//                 <path
//                     fill="#34A853"
//                     d="M12.24 24c3.17 0 5.83-1.05 7.77-2.86l-3.7-2.87c-.99.69-2.32 1.18-4.07 1.18-3.11 0-5.74-2.04-6.68-4.85l-.1.01-3.82 2.94-.05.09C4.5 21.54 8.11 24 12.24 24z"
//                 />
//                 <path
//                     fill="#FBBC05"
//                     d="M5.56 14.6c-.25-.75-.4-1.55-.4-2.38s.15-1.63.4-2.38l-.01-.16-3.87-2.98-.13.06C.4 8.71 0 10.3 0 12c0 1.7.4 3.29 1.55 4.94l4.01-3.09z"
//                 />
//                 <path
//                     fill="#EA4335"
//                     d="M12.24 4.75c2.2 0 3.68.95 4.53 1.74l3.3-3.23C18.05 1.13 15.41 0 12.24 0 8.11 0 4.5 2.46 2.13 6.27l4.01 3.09c.94-2.81 3.57-4.85 6.68-4.85z"
//                 />
//             </svg>

//             <span className="font-medium">Continue with Google</span>
//         </Button>


//     );
// }


export function LoginForm() {

    const { signInWithGoogleToken, signInWithPassword } = useAuth()
    const { toast } = useToast()
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [googleReady, setGoogleReady] = useState(true); // Show Google login initially
    const from = (location.state as any)?.from?.pathname || "/dashboard"

    const handlePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await signInWithPassword(email, password)
            toast({ title: "Signed in", description: "Welcome back!" })
            navigate(from, { replace: true })
        } catch (e: any) {
            toast({
                title: "Sign-in failed",
                description: e.message,
                variant: "destructive",
            })
        }
    }




    return (
        <form className="flex flex-col gap-6" onSubmit={handlePassword} autoComplete="off">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Login to your account</h1>
                <p className="text-muted-foreground text-sm">Enter your email below to login to your account</p>
            </div>
            <div className="grid gap-6">
                <div className="grid gap-3">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        placeholder="m@example.com"
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="grid gap-3">
                    <div className="flex items-center">
                        <Label htmlFor="password">Password</Label>
                        <a href="#" className="ml-auto text-sm underline-offset-4 hover:underline">
                            Forgot your password?
                        </a>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <Button type="submit" className="w-full">Login</Button>

                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                    <span className="bg-background text-muted-foreground relative z-10 px-2">Or continue with</span>
                </div>

                {googleReady ? (
                    <GoogleLogin
                        onSuccess={async (credentialResponse: CredentialResponse) => {
                            if (credentialResponse.credential) {
                                try {
                                    await signInWithGoogleToken(credentialResponse.credential);
                                    toast({ title: "Signed in", description: `Welcome back via Google!` });
                                    navigate(from, { replace: true });
                                } catch (e: any) {
                                    toast({
                                        title: "Sign in failed",
                                        description: e?.message || "Please try again.",
                                        variant: "destructive",
                                    });
                                    setGoogleReady(false); // Fallback if sign-in fails
                                }
                            }
                        }}
                        onError={() => {
                            toast({
                                title: "Google Sign-In failed",
                                description: "Try again later.",
                                variant: "destructive",
                            });
                            setGoogleReady(false); // Switch to fallback button
                        }}
                        theme="outline"
                        size="large"
                        shape="rectangular"
                        text="signin_with"
                        logo_alignment="left"
                    />
                ) : (
                    <button
                        onClick={() => toast({ title: "Fallback Sign-In", description: "Use email/password login" })}
                        className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                    >
                        Sign in with Email
                    </button>
                )}
                {/* <GoogleSignInButton
                    navigate={navigate}
                    from={from}
                    toast={toast}
                    signInWithGoogleToken={signInWithGoogleToken}
                /> */}

            </div>
            <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <a href="/register" className="underline underline-offset-4">
                    Sign up
                </a>
            </div>
        </form >
    )
}
