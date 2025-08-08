import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function Register() {
  useSEO({ title: "Create account — Calibration Alerts", description: "Register with email and password to get started." });
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ username, email, password });
      toast({ title: "Welcome aboard!", description: "Your account is ready." });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e?.message || "Try again.", variant: "destructive" });
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background">
      <Card className="w-full max-w-md shadow-md" aria-label="Register card">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Use a username, email, and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username" />
            <Input placeholder="email@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
            <Button type="submit" className="w-full">Create account</Button>
            <div className="text-sm text-muted-foreground text-center">Already have an account? <a className="underline" href="/login">Sign in</a></div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
