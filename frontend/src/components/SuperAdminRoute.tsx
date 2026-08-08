import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export default function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
