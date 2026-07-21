import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background selection:bg-primary/10">
        <AppSidebar />
        <SidebarInset className="flex-1 overflow-hidden flex flex-col">
          <AppHeader />
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
