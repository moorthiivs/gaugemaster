import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
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

  // Redirect to onboarding if user has not completed setup
  if (isNewCustomer && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding if setup is complete
  if (!isNewCustomer && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
