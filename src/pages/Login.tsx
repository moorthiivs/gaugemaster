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
  const { signInWithOAuth, devEmailLogin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");

  const from = (location.state as any)?.from?.pathname || "/";

  const handleOAuth = async () => {
    await signInWithOAuth();
    toast({ title: "Signed in", description: "Welcome back!" });
    navigate(from, { replace: true });
  };

  const handleDev = async () => {
    await devEmailLogin(email);
    toast({ title: "Signed in (dev)", description: "You are now logged in." });
    navigate(from, { replace: true });
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background">
      <Card className="w-full max-w-md shadow-md" aria-label="Login card">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use OAuth or the dev email stub during development.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={handleOAuth} aria-label="Sign in with OAuth">
            Sign in with OAuth
          </Button>
          <div className="flex items-center gap-2">
            <Input placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Button variant="secondary" onClick={handleDev}>Dev login</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
