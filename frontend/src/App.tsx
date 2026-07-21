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
                  <Route path="/instruments" element={<Instruments />} />
                  <Route path="/instruments/new" element={<InstrumentForm />} />
                  <Route path="/instruments/:id/edit" element={<InstrumentForm />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/calibration" element={<Calibration />} />
                  <Route path="/calibration/new" element={<CalibrationWizard />} />
                  <Route path="/calibration/new/:instrumentId" element={<CalibrationWizard />} />
                  <Route path="/calibration/history/:id" element={<CalibrationHistory />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
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
