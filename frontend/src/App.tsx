import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import SuperAdminRoute from "./components/SuperAdminRoute";
import PublicRoute from "./components/PublicRoute";
import MainLayout from "./components/MainLayout";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { ThemeProvider as CustomThemeProvider } from "@/lib/ThemeContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import PageLoadingFallback from "./components/PageLoadingFallback";

// Lazy-loaded routes for code-splitting
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const OnboardingWizard = lazy(() => import("./components/OnboardingWizard"));
const Index = lazy(() => import("./pages/Index"));
const Instruments = lazy(() => import("./pages/Instruments"));
const InstrumentForm = lazy(() => import("./pages/InstrumentForm"));
const CalibrationProcedures = lazy(() => import("./pages/CalibrationProcedures"));
const WorkInstructions = lazy(() => import("./pages/WorkInstructions"));
const GaugeDiagrams = lazy(() => import("./pages/GaugeDiagrams"));
const Reports = lazy(() => import("./pages/Reports"));
const CalibrationApprovalList = lazy(() => import("./pages/CalibrationApprovalList"));
const TemplateBuilder = lazy(() => import("./pages/TemplateBuilder"));
const TemplateBuilderForm = lazy(() => import("./pages/TemplateBuilderForm"));
const CalibrationWizard = lazy(() => import("./pages/CalibrationWizard"));
const CalibrationHistory = lazy(() => import("./pages/CalibrationHistory"));
const Calibration = lazy(() => import("./pages/Calibration"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const CustomerCompanies = lazy(() => import("./pages/admin/CustomerCompanies"));
const CompanyDetail = lazy(() => import("./pages/admin/CompanyDetail"));
const GlobalAuditLogs = lazy(() => import("./pages/admin/GlobalAuditLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const queryClient = new QueryClient();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const App = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <CustomThemeProvider>
              <TooltipProvider>
                <Sonner />
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    {/* Public pages (Guest-only for login and register) */}
                    <Route path="/" element={<Landing />} />
                    <Route
                      path="/login"
                      element={
                        <PublicRoute>
                          <Login />
                        </PublicRoute>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <PublicRoute>
                          <Register />
                        </PublicRoute>
                      }
                    />

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
                      <Route path="/calibration-procedures" element={<ProtectedRoute module="instruments" action="view"><CalibrationProcedures /></ProtectedRoute>} />
                      <Route path="/work-instructions" element={<ProtectedRoute module="instruments" action="view"><WorkInstructions /></ProtectedRoute>} />
                      <Route path="/gauge-diagrams" element={<ProtectedRoute module="instruments" action="view"><GaugeDiagrams /></ProtectedRoute>} />
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
                </Suspense>
              </TooltipProvider>
            </CustomThemeProvider>
          </NextThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </BrowserRouter>
);

export default App;
