import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";

const Login = () => {
  useSEO({ title: "Login — Calibration Alerts", description: "Sign in to manage instrument calibrations and due dates." });
  const { signInWithProvider, signInWithPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const handleProvider = async (provider: "google" | "github") => {
    try {
      await signInWithProvider(provider);
      toast({ title: "Signed in", description: `Welcome back via ${provider}!` });
      navigate(from, { replace: true });
    } catch (e: any) {
      toast({ title: "Sign in failed", description: e?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handlePassword = async (e: any) => {
    e.preventDefault();
    try {
      await signInWithPassword(email, password);
      toast({ title: "Signed in", description: "Welcome back!" });
      navigate(from, { replace: true });
    } catch (e: any) {
      toast({ title: "Invalid credentials", description: e?.message || "Check your email/password.", variant: "destructive" });
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background">
      <Card className="w-full max-w-md shadow-md" aria-label="Login card">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Continue with Google, GitHub, or email & password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Button className="w-full" onClick={() => handleProvider("google")} aria-label="Sign in with Google">
              Continue with Google
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => handleProvider("github")} aria-label="Sign in with GitHub">
              Continue with GitHub
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
          </div>

          <form className="space-y-3" onSubmit={handlePassword} aria-label="Email password form">
            <Input placeholder="email@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
            <Button type="submit" className="w-full">Sign in with Email</Button>
          </form>

          <div className="text-sm text-muted-foreground text-center">
            New here? <a className="underline" href="/register">Create an account</a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
