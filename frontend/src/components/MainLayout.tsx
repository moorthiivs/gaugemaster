import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { GlobalCopilotMiniBot } from "./common/GlobalCopilotMiniBot";
import { useLocation } from "react-router-dom";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDedicatedBuilderPage = location.pathname.includes("/calibration/templates/builder");

  return (
    <SidebarProvider>
      <div className="h-screen w-full flex overflow-hidden bg-background selection:bg-primary/10">
        <AppSidebar />
        <SidebarInset className="flex-1 h-screen max-h-screen flex flex-col overflow-hidden min-h-0 relative">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 lg:p-6 min-h-0">
            {children}
          </main>
          {!isDedicatedBuilderPage && <GlobalCopilotMiniBot />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

