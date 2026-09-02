import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Gauge } from "lucide-react";

export default function Register() {
  useSEO({
    title: "Start 30-Day Free Trial — Gaugemaster",
    description:
      "Create your Gaugemaster account to start automating gauge calibrations, tracking instrument due dates, scanning QR codes, and passing ISO audits.",
    canonical: "https://gaugemaster.iviewsense.com/register",
  });

  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(name, email, password);
      toast({ title: "Welcome aboard!", description: "Your account is ready." });
      const setupCompleted = localStorage.getItem("setupCompleted");
      const redirectTo = !setupCompleted ? "/onboarding" : from;
      navigate(redirectTo, { replace: true });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e?.message || "Try again.", variant: "destructive" });
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border/80" aria-label="Register card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg shadow-sm">
                <Gauge className="size-5" />
              </div>
              <span>Gaugemaster</span>
            </Link>
          </div>
          <CardTitle className="text-xl font-bold">Start Your 30-Day Free Trial</CardTitle>
          <CardDescription>No credit card required. Instant access for your manufacturing plant.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
              <Input
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Full Name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Work Email</label>
              <Input
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Password</label>
              <Input
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
                required
              />
            </div>
            <Button type="submit" className="w-full font-semibold rounded-lg">
              Create Account &amp; Start Trial
            </Button>
            <div className="text-xs text-muted-foreground text-center pt-2">
              Already have an account?{" "}
              <Link className="text-primary font-semibold hover:underline" to="/login">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
