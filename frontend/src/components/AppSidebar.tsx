import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Gauge,
  PlusCircle,
  FileCheck2,
  Layers,
  LineChart,
  CalendarRange,
  UserCheck,
  Sliders,
  LogOut,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
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

import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { Building2 } from "lucide-react";
import SidebarTrialCard from "./SidebarTrialCard";

const superAdminGroup = {
  label: "Platform Management",
  items: [
    { title: "Customer Companies", url: "/super-admin/companies", icon: Building2, module: "superadmin", action: "view" },
  ],
};

const navigationGroups = [
  {
    label: "Operations",
    items: [
      { title: "Analytics Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard", action: "view" },
      { title: "Calibration Execution", url: "/calibration", icon: FileCheck2, module: "calibrations", action: "view" },
      { title: "Calibration Approval", url: "/calibration/approval", icon: CheckCircle2, module: "calibrations", action: "view" },
      { title: "Calibration Schedule", url: "/calendar", icon: CalendarRange, module: "instruments", action: "view" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Instrument Master", url: "/instruments", icon: Gauge, module: "instruments", action: "view" },
      { title: "Register Instrument", url: "/instruments/new", icon: PlusCircle, module: "instruments", action: "create" },
      { title: "Calibration Templates", url: "/calibration/templates", icon: Layers, module: "templates", action: "view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Reports & Analytics", url: "/reports", icon: LineChart, module: "reports", action: "view" },
      { title: "User Access Control", url: "/users", icon: UserCheck, module: "users", action: "view" },
      { title: "System Configuration", url: "/settings", icon: Sliders, module: "settings", action: "view" },
    ],
  },
];

export function AppSidebar() {
  const { canAccess } = usePermissions();
  const { user } = useAuth();

  const activeGroups = user?.isSuperAdmin
    ? [superAdminGroup]
    : navigationGroups;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-sidebar/90 backdrop-blur-md shadow-lg transition-all duration-300">
      <SidebarHeader className="p-5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-4">
        <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg border border-primary/20 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:mx-auto">
            <ShieldCheck className="h-5 w-5 text-primary group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-base font-bold tracking-tight text-sidebar-foreground">Gaugemaster</span>
            <span className="text-[10px] uppercase tracking-wider text-primary font-bold opacity-80">Calibration Suite</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 space-y-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        {activeGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(item.module, item.action as any));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:px-0 py-0">
              <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:items-center">
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                      <SidebarMenuButton asChild tooltip={item.title} className="h-9 relative group/btn group-data-[collapsible=icon]:mx-auto">
                        <NavLink 
                          to={item.url} 
                          end 
                          className={({ isActive }) => cn(
                            "flex items-center gap-2.5 px-3 w-full h-full rounded-md text-xs font-medium transition-all duration-200 relative group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:mx-auto",
                            isActive 
                              ? "bg-primary/15 text-primary font-semibold shadow-xs" 
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-sm group-data-[collapsible=icon]:h-3" />
                              )}
                              <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover/btn:scale-105", isActive && "text-primary")} />
                              <span className="group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Sidebar Trial Card placed right above bottom menu / logout */}
        <SidebarTrialCard />

        <SidebarGroup className="mt-auto mb-3 border-t border-sidebar-border/60 pt-3 group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton asChild className="p-0 h-auto group-data-[collapsible=icon]:mx-auto">
                  <NavLink to="/login" className={({ isActive }) => cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:mx-auto",
                    isActive && "bg-destructive/10"
                  )} aria-label="Sign out">
                    <LogOut className="h-4 w-4 shrink-0" />
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

