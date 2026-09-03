// components/login-form.tsx
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { GoogleLogin, CredentialResponse, GoogleOAuthProvider } from "@react-oauth/google"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import axios from "axios"

export function LoginForm() {

    const { signInWithGoogleToken, signInWithPassword, isNewCustomer } = useAuth()
    const { toast } = useToast()
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [googleReady, setGoogleReady] = useState(true);
    const [loading, setLoading] = useState(false);
    const from = (location.state as any)?.from?.pathname || "/dashboard"

    // Auth configuration from backend
    const [authConfig, setAuthConfig] = useState<{
        googleEnabled: boolean;
        googleClientId?: string | null;
        registrationEnabled: boolean;
    } | null>(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get("session_expired") === "true") {
            toast({
                title: "Session Expired",
                description: "Your session has expired. Please sign in again to continue.",
                variant: "destructive",
            });
        }
    }, [location.search, toast]);

    useEffect(() => {
        axios.get(`/api/auth/config`)
            .then(res => setAuthConfig(res.data))
            .catch(() => {
                // Fallback: assume no Google, no registration
                setAuthConfig({ googleEnabled: false, registrationEnabled: false });
            });
    }, []);

    // Check if Google authentication is enabled on the server
    const showGoogle = authConfig?.googleEnabled === true;
    const showRegistration = authConfig?.registrationEnabled;

    const handlePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true);
        try {
            await signInWithPassword(email, password)
            toast({ title: "Signed in", description: "Welcome back!" })

            const storedUser = localStorage.getItem('auth_user')
            const parsedUser = storedUser ? JSON.parse(storedUser) : null

            if (parsedUser?.isSuperAdmin) {
                navigate("/super-admin/companies", { replace: true });
                return;
            }

            // Check if user needs onboarding after login
            const setupCompleted = localStorage.getItem('setupCompleted')
            const redirectTo = !setupCompleted ? "/onboarding" : from
            navigate(redirectTo, { replace: true })
        } catch (e: any) {
            toast({
                title: "Sign-in failed",
                description: e.message,
                variant: "destructive",
            })
        } finally {
            setLoading(false);
        }
    }


    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (credentialResponse.credential) {
            try {
                await signInWithGoogleToken(credentialResponse.credential);
                toast({ title: "Signed in", description: `Welcome back via Google!` });
                // Check if user needs onboarding after login
                const setupCompleted = localStorage.getItem('setupCompleted');
                const redirectTo = !setupCompleted ? "/onboarding" : from;
                navigate(redirectTo, { replace: true });
            } catch (e: any) {
                toast({
                    title: "Sign in failed",
                    description: e?.message || "Please try again.",
                    variant: "destructive",
                });
                setGoogleReady(false);
            }
        }
    };

    const handleGoogleError = () => {
        toast({
            title: "Google Sign-In failed",
            description: "Try again later.",
            variant: "destructive",
        });
        setGoogleReady(false);
    };

    const renderGoogleButton = () => (
        <div className="w-full flex justify-center [&>div]:w-full [&_iframe]:!w-full">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                shape="rectangular"
                text="continue_with"
                width="384"
                logo_alignment="left"
                auto_select={false}
            />
        </div>
    );

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
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Logging in..." : "Login"}</Button>

                {/* Google Sign-In — only shown when both backend + frontend are configured */}
                {showGoogle && (
                    <>
                        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                            <span className="bg-background text-muted-foreground relative z-10 px-2">Or continue with</span>
                        </div>

                        {googleReady ? (
                            authConfig?.googleClientId ? (
                                <GoogleOAuthProvider clientId={authConfig.googleClientId}>
                                    {renderGoogleButton()}
                                </GoogleOAuthProvider>
                            ) : (
                                renderGoogleButton()
                            )
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => toast({ title: "Fallback Sign-In", description: "Use email/password login" })}
                                className="w-full"
                            >
                                Sign in with Email
                            </Button>
                        )}
                    </>
                )}

            </div>

            {/* Registration link — only shown when backend allows public registration */}
            {showRegistration && (
                <div className="text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <a href="/register" className="underline underline-offset-4">
                        Sign up
                    </a>
                </div>
            )}
        </form >
    )
}
