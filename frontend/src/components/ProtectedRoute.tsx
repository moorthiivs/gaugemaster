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
  module?: string | string[];
  action?: "create" | "edit" | "view" | "delete" | ("create" | "edit" | "view" | "delete")[];
}) {
  const { user, token, loading, isNewCustomer, inspectedCompany } = useAuth();
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

  // Super Admin redirect to platform management if not inspecting a company
  if (user?.isSuperAdmin) {
    const isPlatformRoute =
      location.pathname.startsWith("/super-admin") ||
      location.pathname === "/profile";
    if (!inspectedCompany && !isPlatformRoute) {
      return <Navigate to="/super-admin/companies" replace />;
    }
  } else {
    // Redirect to onboarding if user has not completed setup
    if (isNewCustomer && location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    // Prevent accessing onboarding if setup is complete
    if (!isNewCustomer && location.pathname === "/onboarding") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Module level permission guard (supports single module/action string or array of alternatives)
  if (module) {
    const modules = Array.isArray(module) ? module : [module];
    const actions = Array.isArray(action) ? action : [action];
    const hasAccess = modules.some((m) => actions.some((a) => canAccess(m, a)));
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
