import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen w-full flex overflow-hidden bg-background selection:bg-primary/10">
        <AppSidebar />
        <SidebarInset className="flex-1 h-screen max-h-screen flex flex-col overflow-hidden min-h-0">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 lg:p-6 min-h-0">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
