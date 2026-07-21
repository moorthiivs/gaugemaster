import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wrench, PlusCircle, BarChart3, User, Settings, LogOut, Activity, CalendarDays, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Instruments", url: "/instruments", icon: Wrench },
  { title: "Add Instrument", url: "/instruments/new", icon: PlusCircle },
  { title: "Calibration", url: "/calibration", icon: Activity },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar shadow-2xl transition-all duration-500">
      <SidebarHeader className="p-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-4">
        <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
          <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-xl shadow-inner border border-primary/20 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:rounded-lg">
            <ShieldCheck className="h-6 w-6 text-primary animate-pulse group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Gaugemaster</span>
            <span className="text-[10px] uppercase tracking-widest text-primary font-bold opacity-80">Calibration</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <SidebarGroup className="group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton asChild tooltip={item.title} className="h-10 relative overflow-hidden group/btn group-data-[collapsible=icon]:mx-auto">
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 w-full h-full rounded-md transition-all duration-300 relative group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto",
                        isActive 
                          ? "bg-primary/15 text-primary font-semibold" 
                          : "text-sidebar-foreground dark:text-slate-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:text-white"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md shadow-[0_0_8px_rgba(0,0,0,0.5)] shadow-primary/50 group-data-[collapsible=icon]:h-4" />
                          )}
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform group-hover/btn:scale-110", isActive && "text-primary")} />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto mb-4 border-t border-sidebar-border pt-4 group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton asChild className="p-0 h-auto group-data-[collapsible=icon]:mx-auto">
                  <NavLink to="/login" className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-300 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto",
                    isActive && "bg-destructive/10"
                  )} aria-label="Sign out">
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span className="font-medium group-data-[collapsible=icon]:hidden">Sign out</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
