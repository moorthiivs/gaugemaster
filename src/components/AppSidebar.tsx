import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Wrench, PlusCircle, BarChart3, User, Settings, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Instruments", url: "/instruments", icon: Wrench },
  { title: "Add Instrument", url: "/instruments/new", icon: PlusCircle },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "justify-start",
      isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
    );

  return (
    <Sidebar className="w-60">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Calibration Alerts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls} aria-label={item.title}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/login" className={getNavCls} aria-label="Sign out">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
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
