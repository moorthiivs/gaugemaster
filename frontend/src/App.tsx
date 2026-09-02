import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Instruments from "./pages/Instruments";
import InstrumentForm from "./pages/InstrumentForm";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/MainLayout";
import { AuthProvider } from "@/lib/auth";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import OnboardingWizard from "./components/OnboardingWizard";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { ThemeProvider as CustomThemeProvider } from "@/lib/ThemeContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

import CalendarPage from "./pages/CalendarPage";
import Calibration from "./pages/Calibration";
import CalibrationWizard from "./pages/CalibrationWizard";
import CalibrationHistory from "./pages/CalibrationHistory";
import TemplateBuilder from "./pages/TemplateBuilder";
import TemplateBuilderForm from "./pages/TemplateBuilderForm";
import CalibrationApprovalList from "./pages/CalibrationApprovalList";
import UserManagement from "./pages/UserManagement";
import SuperAdminRoute from "./components/SuperAdminRoute";
import CustomerCompanies from "./pages/admin/CustomerCompanies";
import CompanyDetail from "./pages/admin/CompanyDetail";
import GlobalAuditLogs from "./pages/admin/GlobalAuditLogs";

const queryClient = new QueryClient();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Wrap children in GoogleOAuthProvider only when a client ID is configured */
function OptionalGoogleProvider({ children }: { children: React.ReactNode }) {
  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
  }
  return <>{children}</>;
} 

const App = () => (
  <BrowserRouter>
    <OptionalGoogleProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <CustomThemeProvider>
              <TooltipProvider>
              <Sonner />
              <Routes>
                {/* Public pages */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Onboarding */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <OnboardingWizard />
                    </ProtectedRoute>
                  }
                />

                {/* Protected app */}
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Outlet />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/instruments" element={<ProtectedRoute module="instruments" action="view"><Instruments /></ProtectedRoute>} />
                  <Route path="/instruments/new" element={<ProtectedRoute module="instruments" action="create"><InstrumentForm /></ProtectedRoute>} />
                  <Route path="/instruments/:id/edit" element={<ProtectedRoute module="instruments" action="edit"><InstrumentForm /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute module="reports" action="view"><Reports /></ProtectedRoute>} />
                  <Route path="/calibration/approval" element={<ProtectedRoute module="calibrations" action="view"><CalibrationApprovalList /></ProtectedRoute>} />
                  <Route path="/calibration/templates" element={<ProtectedRoute module="templates" action="view"><TemplateBuilder /></ProtectedRoute>} />
                  <Route path="/calibration/templates/builder" element={<ProtectedRoute module="templates" action="edit"><TemplateBuilderForm /></ProtectedRoute>} />
                  <Route path="/calibration/new" element={<ProtectedRoute module="calibrations" action="create"><CalibrationWizard /></ProtectedRoute>} />
                  <Route path="/calibration/new/:instrumentId" element={<ProtectedRoute module="calibrations" action="create"><CalibrationWizard /></ProtectedRoute>} />
                  <Route path="/calibration/history/:id" element={<ProtectedRoute module="calibrations" action="view"><CalibrationHistory /></ProtectedRoute>} />
                  <Route path="/calibration" element={<ProtectedRoute module="calibrations" action="view"><Calibration /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute module="instruments" action="view"><CalendarPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute module="users" action="view"><UserManagement /></ProtectedRoute>} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<ProtectedRoute module="settings" action="view"><Settings /></ProtectedRoute>} />

                  {/* Super Admin Management Routes */}
                  <Route path="/super-admin/companies" element={<SuperAdminRoute><CustomerCompanies /></SuperAdminRoute>} />
                  <Route path="/super-admin/companies/:id" element={<SuperAdminRoute><CompanyDetail /></SuperAdminRoute>} />
                  <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><GlobalAuditLogs /></SuperAdminRoute>} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </CustomThemeProvider>
        </NextThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </OptionalGoogleProvider>
  </BrowserRouter>
);

export default App;
