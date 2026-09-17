import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/**
 * PublicRoute prevents authenticated users from viewing guest-only auth pages (/login, /register).
 * If a valid authenticated session exists:
 * - Super Admins are redirected to /super-admin/companies (or /dashboard if inspecting a company)
 * - Users needing onboarding are redirected to /onboarding
 * - Regular users are redirected to /dashboard or their intended destination
 */
export default function PublicRoute({ children }: { children: ReactNode }) {
  const { user, token, loading, isNewCustomer, inspectedCompany } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (token && user) {
    if (user.isSuperAdmin) {
      const dest = inspectedCompany ? "/dashboard" : "/super-admin/companies";
      return <Navigate to={dest} replace />;
    }

    if (isNewCustomer) {
      return <Navigate to="/onboarding" replace />;
    }

    // Check if there is a 'redirect' query parameter or location.state.from
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get("redirect");
    const stateFrom = (location.state as any)?.from?.pathname;

    let destination = "/dashboard";
    if (redirectParam && redirectParam !== "/login" && redirectParam !== "/register" && redirectParam !== "/") {
      destination = redirectParam;
    } else if (stateFrom && stateFrom !== "/login" && stateFrom !== "/register" && stateFrom !== "/") {
      destination = stateFrom;
    }

    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}
