import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

import { usePermissions } from "@/hooks/usePermissions";

export default function ProtectedRoute({
  children,
  module,
  action = "view",
}: {
  children: ReactNode;
  module?: string;
  action?: "create" | "edit" | "view" | "delete";
}) {
  const { token, loading, isNewCustomer } = useAuth();
  const { canAccess } = usePermissions();
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

  // Module level permission guard
  if (module && !canAccess(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
