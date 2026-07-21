import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export default function OnboardingRoute({ children }: { children: ReactNode }) {
  const { token, loading, isNewCustomer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user has completed setup, redirect to dashboard
  if (!isNewCustomer) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}