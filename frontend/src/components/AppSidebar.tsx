import { NavLink, useNavigate } from "react-router-dom";
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
  Building2,
  X,
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
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
  const { user, inspectedCompany, setInspectedCompany, signOut } = useAuth();
  const navigate = useNavigate();

  const activeGroups = user?.isSuperAdmin
    ? (inspectedCompany ? [superAdminGroup, ...navigationGroups] : [superAdminGroup])
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

        {/* Sidebar Trial Card placed right above bottom footer */}
        <SidebarTrialCard />
      </SidebarContent>

      {/* Pinned Bottom Footer with User Profile Picture & Sign Out */}
      <SidebarFooter className="p-3 border-t border-sidebar-border/60 mt-auto bg-sidebar/95">
        {/* Inspected Company Banner for SuperAdmin */}
        {user?.isSuperAdmin && inspectedCompany && (
          <div className="mb-2 p-2 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-primary">Viewing Tenant</p>
                <p className="text-xs font-bold truncate text-sidebar-foreground">{inspectedCompany.name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              title="Exit Company View"
              onClick={() => {
                setInspectedCompany(null);
                navigate("/super-admin/companies");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* User Profile Card + Sign Out Button */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
              <AvatarImage src={user?.avatarUrl} alt={user?.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-xs font-bold truncate text-sidebar-foreground">{user?.name || "User"}</span>
              <span className="text-[10px] text-muted-foreground truncate">{user?.isSuperAdmin ? "Super Admin" : user?.email || "Member"}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
            title="Sign out"
            onClick={() => {
              signOut();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

