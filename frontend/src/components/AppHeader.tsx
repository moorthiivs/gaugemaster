import { useState, useEffect, useRef } from "react";
import { Bell, LogOut, Moon, Search, Settings, Sun, User, User as UserIcon, Loader2, CheckCircle2, XCircle, DownloadCloudIcon, AlertCircle, FileSpreadsheet, Mail, AlertTriangle, Trash2, LayoutDashboard, Wrench, PlusCircle, BarChart3, CalendarDays, UserCheck, Zap, ChevronDown, Layers, FileCheck2, Gauge, ChevronRight, X, Building2 } from "lucide-react";
import { useNavigate, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useThemeSettings } from "@/lib/ThemeContext";
import httpClient from "@/lib/httpClient";
import { useToast } from "@/hooks/use-toast";
import { saveAs } from "file-saver";
import { exportRejectedToExcel } from "./ExcelUpload";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Instrument } from "@/types/instrument";

interface UploadJob {
  id: string;
  fileName: string;
  status: string; // 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  errors: any[];
  created_at: string;
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface QuickActionConfig {
  title: string;
  description: string;
  url: string;
  icon: any;
  module: string;
  action: "create" | "edit" | "view" | "delete";
  badge?: string;
  category: "Operations" | "Master Data" | "Admin";
}

const quickActionsConfig: QuickActionConfig[] = [
  { 
    title: "Register Instrument", 
    description: "Add new gauge / instrument to inventory", 
    url: "/instruments/new", 
    icon: PlusCircle, 
    module: "instruments", 
    action: "create", 
    badge: "New",
    category: "Master Data" 
  },
  { 
    title: "Calibration Execution", 
    description: "Perform instrument calibration entry", 
    url: "/calibration", 
    icon: FileCheck2, 
    module: "calibrations", 
    action: "view",
    category: "Operations" 
  },
  { 
    title: "Calibration Approvals", 
    description: "Review pending calibration entries", 
    url: "/calibration/approval", 
    icon: CheckCircle2, 
    module: "calibrations", 
    action: "view",
    category: "Operations" 
  },
  { 
    title: "Calibration Schedule", 
    description: "View upcoming calibration calendar", 
    url: "/calendar", 
    icon: CalendarDays, 
    module: "instruments", 
    action: "view",
    category: "Operations" 
  },
  { 
    title: "Template Builder", 
    description: "Configure calibration procedures", 
    url: "/calibration/templates", 
    icon: Layers, 
    module: "templates", 
    action: "view",
    category: "Master Data" 
  },
  { 
    title: "Reports & Analytics", 
    description: "Export & view analytical reports", 
    url: "/reports", 
    icon: BarChart3, 
    module: "reports", 
    action: "view",
    category: "Admin" 
  },
  { 
    title: "User Management", 
    description: "Manage operators & permissions", 
    url: "/users", 
    icon: UserCheck, 
    module: "users", 
    action: "view",
    category: "Admin" 
  },
];

export function AppHeader() {
  const { user, inspectedCompany, setInspectedCompany, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { themeSettings, saveTheme } = useThemeSettings();
  const { toast } = useToast();
  const { canAccess } = usePermissions();

  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isDownloadingJobId, setIsDownloadingJobId] = useState<string | null>(null);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<UploadJob | null>(null);
  const [selectedNotificationForDetail, setSelectedNotificationForDetail] = useState<AppNotification | null>(null);

  // Search Auto-Suggestions State
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Instrument[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const superAdminQuickActions: QuickActionConfig[] = [
    {
      title: "Customer Companies",
      description: "Manage customer companies & access control",
      url: "/super-admin/companies",
      icon: Building2,
      module: "superadmin",
      action: "view",
      category: "Admin",
    },
  ];

  // Filter Quick Actions based on User Role Permissions
  const visibleQuickActions = user?.isSuperAdmin
    ? (inspectedCompany ? [...superAdminQuickActions, ...quickActionsConfig] : superAdminQuickActions)
    : quickActionsConfig.filter((item) => canAccess(item.module, item.action));

  const categories = ["Operations", "Master Data", "Admin"] as const;

  // Keyboard shortcut (Cmd+K / Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch search suggestions with 200ms debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await httpClient.get("/instruments", {
          params: { search: searchQuery.trim(), limit: 6, companyId: user?.companyId, createdBy: user?.id }
        });
        const items = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
        setSuggestions(items.slice(0, 6));
      } catch (err) {
        console.error("Search auto-suggestion error:", err);
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (item: Instrument) => {
    setSearchOpen(false);
    setSearchQuery("");
    const query = item.id_code || item.name;
    navigate(`/instruments?search=${encodeURIComponent(query)}`);
  };

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    navigate(`/instruments?search=${encodeURIComponent(searchQuery.trim())}`);
  };
  
  const previousJobsCountRef = useRef<number | null>(null);
  const activeJobsRef = useRef<string[]>([]);

  const toggleTheme = () => {
    const newScheme = themeSettings.colorScheme === "dark" ? "light" : "dark";
    saveTheme({
      ...themeSettings,
      colorScheme: newScheme,
    });
    setTheme(newScheme);
  };

  const handleCancelJob = async (jobId: string) => {
    setIsCancellingId(jobId);
    try {
      await httpClient.post(`/upload-jobs/cancel/${jobId}`);
      toast({
        title: "Upload Cancelled 🛑",
        description: "The background upload job was successfully cancelled.",
      });
      fetchJobs(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Cancel Error",
        description: "Could not cancel the background upload job",
        variant: "destructive"
      });
    } finally {
      setIsCancellingId(null);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await httpClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast({
        title: "Notification Deleted",
        description: "The notification was removed successfully."
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Delete Error",
        description: "Could not delete notification.",
        variant: "destructive"
      });
    }
  };

  const fetchJobs = async (silent = false) => {
    if (!user?.companyId) return;
    try {
      const [res, notifRes] = await Promise.all([
        httpClient.get<UploadJob[]>(`/upload-jobs/company/${user.companyId}`),
        httpClient.get<AppNotification[]>(`/notifications/company/${user.companyId}`).catch(() => ({ data: [] }))
      ]);
      const latestJobs = Array.isArray(res.data) ? res.data : [];
      const latestNotifs = Array.isArray(notifRes.data) ? notifRes.data : [];

      if (latestNotifs.some(n => !n.is_read)) {
        setHasUnread(true);
      }

      if (previousJobsCountRef.current !== null) {
        latestJobs.forEach(job => {
          const wasActive = activeJobsRef.current.includes(job.id);
          const isDone = job.status === "completed" || job.status === "failed";
          
          if (wasActive && isDone) {
            if (job.status === "completed") {
              toast({
                title: "Upload Job Complete 🎉",
                description: `File "${job.fileName}" successfully imported (${job.successCount} saved, ${job.failedCount} failed).`,
              });
            } else {
              toast({
                title: "Upload Job Failed ❌",
                description: `File "${job.fileName}" failed during processing. Check logs for details.`,
                variant: "destructive",
              });
            }
          }
        });
      }

      setJobs(latestJobs);
      setNotifications(latestNotifs);
      previousJobsCountRef.current = latestJobs.length;
      activeJobsRef.current = latestJobs
        .filter(j => j.status === "pending" || j.status === "processing")
        .map(j => j.id);

    } catch (err) {
      if (!silent) console.error("Error fetching upload jobs:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => fetchJobs(true), 4000);
    return () => {
      clearInterval(interval);
    };
  }, [user?.companyId]);

  useEffect(() => {
    // Listen for custom window event from ExcelUpload to trigger instant refetch
    const handleUploadStarted = () => {
      fetchJobs(true);
    };
    window.addEventListener("background-upload-started", handleUploadStarted);
    return () => {
      window.removeEventListener("background-upload-started", handleUploadStarted);
    };
  }, [user?.companyId]);

  const handleOpenNotifications = async () => {
    setHasUnread(false);
    fetchJobs(true);
    
    // Mark all currently unread notifications as read
    const unreadNotifs = notifications.filter(n => !n.is_read);
    for (const n of unreadNotifs) {
      await httpClient.post(`/notifications/${n.id}/read`).catch(console.error);
    }
    if (unreadNotifs.length > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const allItems = [
    ...jobs.map(j => ({ ...j, itemType: 'job' as const, time: new Date(j.created_at).getTime() })),
    ...notifications.map(n => ({ ...n, itemType: 'notification' as const, time: new Date(n.created_at).getTime() }))
  ].sort((a, b) => b.time - a.time);

  const handleDownloadFailed = async (e: React.MouseEvent, job: UploadJob) => {
    e.stopPropagation(); // Prevent closing dropdown
    setIsDownloadingJobId(job.id);
    try {
      const exportData = job.errors.map((item: any) => ({
        ...item.raw,
        "ERROR DESCRIPTION": item.error
      }));
      const buffer = await exportRejectedToExcel(exportData);
      saveAs(new Blob([buffer]), `Fix_These_Rows_${job.fileName}`);
    } catch (err) {
      console.error(err);
      toast({
        title: "Export Error",
        description: "Could not generate failed rows spreadsheet",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingJobId(null);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 shadow-sm transition-all duration-300">
      <div className="h-14 flex items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">Gaugemaster</span>
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              PRO
            </span>
          </div>
        </div>

        {/* Global Quick Search Input with Live Auto-Suggestions */}
        <div className="hidden md:flex items-center relative w-80 md:w-[420px] lg:w-[500px]">
          <Popover open={searchOpen && searchQuery.trim().length > 0} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 pointer-events-none" aria-hidden />
                <Input 
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search instruments by Code, Name, Location..." 
                  aria-label="Search instruments" 
                  className="pl-9 pr-14 h-9 text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background transition-all border-border/70 rounded-lg font-medium shadow-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                />
                {searchQuery ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground rounded-md"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchOpen(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <kbd className="absolute right-2.5 top-2.5 pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/80 px-1.5 font-mono text-[9px] font-semibold text-muted-foreground">
                    ⌘K
                  </kbd>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent 
              align="start" 
              className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden glass-popover rounded-xl shadow-2xl border border-border/80 mt-1.5"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="p-2.5 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  Auto-Suggestions
                </span>
                {searchLoading ? (
                  <span className="text-[10px] text-primary flex items-center gap-1 font-semibold">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                  </span>
                ) : (
                  <Badge variant="secondary" className="text-[9px] font-mono font-bold px-1.5 py-0">
                    {suggestions.length} Results
                  </Badge>
                )}
              </div>

              <div className="max-h-[340px] overflow-y-auto divide-y divide-border/30">
                {suggestions.length === 0 && !searchLoading ? (
                  <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground/80">No matching instruments found</p>
                    <p className="text-[10px] text-muted-foreground">Press Enter to search full inventory</p>
                  </div>
                ) : (
                  suggestions.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 group-hover:scale-105 transition-transform">
                          <Gauge className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate tracking-tight">{item.name}</span>
                            {item.id_code && (
                              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-background text-primary border-primary/30 shrink-0">
                                {item.id_code}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                            {item.location && <span>Loc: {item.location}</span>}
                            {item.make && <span>• Make: {item.make}</span>}
                            {item.serial_no && <span>• S/N: {item.serial_no}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge 
                          variant={item.status === 'Overdue' ? 'destructive' : item.status === 'Calibrated' || item.status === 'Pass' ? 'default' : 'secondary'} 
                          className={cn(
                            "text-[10px] px-2 py-0.5 font-semibold capitalize shrink-0 shadow-xs",
                            item.status === 'Overdue' && "bg-red-500/15 text-red-600 border border-red-500/30 hover:bg-red-500/20",
                            (item.status === 'Calibrated' || item.status === 'Pass') && "bg-green-500/15 text-green-700 border border-green-500/30 hover:bg-green-500/20",
                            item.status === 'Due Soon' && "bg-amber-500/15 text-amber-700 border border-amber-500/30 hover:bg-amber-500/20"
                          )}
                        >
                          {item.status || 'Active'}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div 
                className="p-2.5 bg-muted/30 border-t border-border/50 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-between"
                onClick={handleSearchSubmit}
              >
                <span className="truncate pr-2">Search all inventory matching <strong>"{searchQuery}"</strong></span>
                <kbd className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold bg-primary text-primary-foreground rounded shadow-xs shrink-0">
                  Enter ↵
                </kbd>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          {user?.isSuperAdmin && inspectedCompany && (
            <div className="hidden md:flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-semibold px-3 py-1 rounded-lg">
              <Building2 className="h-3.5 w-3.5" />
              <span>Viewing: <strong className="font-bold text-foreground">{inspectedCompany.name}</strong></span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded ml-1"
                onClick={() => {
                  setInspectedCompany(null);
                  navigate("/super-admin/companies");
                }}
              >
                Exit View
              </Button>
            </div>
          )}

          {/* Dynamic Permission-Based Quick Actions Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 px-3.5 gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 shadow-md transition-all rounded-lg">
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span className="hidden sm:inline">Quick Actions</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-1.5 glass-popover rounded-xl shadow-2xl border-border/70">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/50">
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  Quick Actions
                </span>
                <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                  {visibleQuickActions.length} Actions
                </Badge>
              </div>

              <div className="max-h-80 overflow-y-auto py-1 space-y-2">
                {visibleQuickActions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No actions available for your current role.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const catActions = visibleQuickActions.filter((a) => a.category === cat);
                    if (catActions.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 pt-1">
                          {cat}
                        </div>
                        {catActions.map((action) => (
                          <DropdownMenuItem 
                            key={action.title} 
                            className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-all group"
                            onClick={() => navigate(action.url)}
                          >
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                              <action.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-foreground truncate">{action.title}</span>
                                {action.badge && (
                                  <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.2 rounded shrink-0">
                                    {action.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 leading-normal">{action.description}</p>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Switcher */}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Toggle theme" onClick={toggleTheme}>
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>

          <DropdownMenu onOpenChange={(open) => open && handleOpenNotifications()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {(hasUnread || jobs.some(j => j.status === 'processing') || notifications.some(n => !n.is_read)) && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0 overflow-hidden" align="end" forceMount>
              <DropdownMenuLabel className="font-bold border-b p-3 bg-muted/20 flex items-center justify-between">
                <span>Notifications</span>
                {allItems.length > 0 && <Badge variant="secondary" className="text-[10px]">{allItems.length} Total</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="m-0" />
              
              <div className="max-h-80 overflow-y-auto divide-y divide-muted">
                {allItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs space-y-2">
                    <Bell className="h-8 w-8 mx-auto opacity-30 animate-pulse" />
                    <p>No recent notifications or uploads.</p>
                  </div>
                ) : (
                  allItems.map((item) => {
                    if (item.itemType === 'notification') {
                      const notif = item as AppNotification & { itemType: 'notification', time: number };
                      return (
                        <div key={`notif-${notif.id}`} className={`p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${!notif.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`} onClick={() => setSelectedNotificationForDetail(notif)}>
                          <div className="mt-0.5 flex-shrink-0">
                            {notif.type === 'mail_success' && <Mail className="h-4.5 w-4.5 text-green-500" />}
                            {notif.type === 'mail_error' && <Mail className="h-4.5 w-4.5 text-red-500" />}
                            {notif.type === 'gauge_due' && <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />}
                            {notif.type === 'general' && <Bell className="h-4.5 w-4.5 text-blue-500" />}
                          </div>
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className={`text-xs leading-none truncate pr-2 ${!notif.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`} title={notif.title}>
                                {notif.title}
                              </p>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => handleDeleteNotification(e, notif.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {notif.message}
                            </p>
                            <p className="text-[9px] text-muted-foreground/60 mt-1">
                              {notif.created_at ? new Date(notif.created_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'N/A'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const job = item as UploadJob & { itemType: 'job', time: number };
                    const pct = job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
                    
                    return (
                      <div key={`job-${job.id}`} className="p-3.5 hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer" onClick={() => setSelectedJobForDetail(job)}>
                        <div className="mt-0.5 flex-shrink-0">
                          {job.status === "processing" && (
                            <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                          )}
                          {job.status === "completed" && job.failedCount === 0 && (
                            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                          )}
                          {job.status === "completed" && job.failedCount > 0 && (
                            <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
                          )}
                          {job.status === "failed" && (
                            <XCircle className="h-4.5 w-4.5 text-red-500" />
                          )}
                          {job.status === "cancelled" && (
                            <XCircle className="h-4.5 w-4.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <p className="text-xs font-bold leading-none truncate text-foreground pr-2" title={job.fileName}>
                            {job.fileName}
                          </p>
                          
                          {job.status === "processing" ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{job.processedRows}/{job.totalRows} rows</span>
                                <span className="font-semibold">{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1" />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <p className="text-[10px] text-muted-foreground">
                                {job.status === "completed" ? (
                                  <>
                                    <span className="text-green-600 font-medium">{job.successCount} saved</span>
                                    {job.failedCount > 0 && (
                                      <>
                                        {" • "}
                                        <span className="text-red-500 font-medium">{job.failedCount} errors</span>
                                      </>
                                    )}
                                  </>
                                ) : job.status === "cancelled" ? (
                                  <span className="text-muted-foreground font-medium">Job cancelled</span>
                                ) : (
                                  <span className="text-red-500 font-medium">Job failed</span>
                                )}
                              </p>
                              <span className="text-[9px] text-muted-foreground/60">
                                {job.created_at ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {job.status === "completed" && job.failedCount > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 flex-shrink-0"
                            disabled={isDownloadingJobId === job.id}
                            onClick={(e) => handleDownloadFailed(e, job)}
                            title="Download Failed Rows"
                          >
                            {isDownloadingJobId === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <DownloadCloudIcon className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>



          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.avatarUrl} alt={user?.name || "User"} />
                  <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Signed in as {user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  signOut();
                  navigate("/login", { replace: true });
                }}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}


          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} alt={user?.name || "User"} />
                  <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.isSuperAdmin ? (
                <DropdownMenuItem onClick={() => navigate("/super-admin/companies")}>
                  <Building2 className="mr-2 h-4 w-4 text-primary" />
                  <span>Customer Companies</span>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate("/users")}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    <span>User & Access Control</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>System Configuration</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                signOut();
                navigate("/login", { replace: true });
              }}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Notification Detail Dialog */}
      <Dialog open={!!selectedNotificationForDetail} onOpenChange={(open) => !open && setSelectedNotificationForDetail(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {selectedNotificationForDetail?.type === 'mail_success' && <Mail className="h-5 w-5 text-green-500" />}
              {selectedNotificationForDetail?.type === 'mail_error' && <Mail className="h-5 w-5 text-red-500" />}
              {selectedNotificationForDetail?.type === 'gauge_due' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {selectedNotificationForDetail?.type === 'general' && <Bell className="h-5 w-5 text-blue-500" />}
              {selectedNotificationForDetail?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNotificationForDetail?.created_at && new Date(selectedNotificationForDetail.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 text-sm text-foreground space-y-4">
            <p className="whitespace-pre-wrap">{selectedNotificationForDetail?.message}</p>
          </div>
          {selectedNotificationForDetail?.type === 'gauge_due' && (() => {
            const match = selectedNotificationForDetail.message.match(/\(S\/N:\s*(.*?)\)/);
            if (match && match[1]) {
              return (
                <div className="pt-4 border-t mt-4">
                  <Button 
                    className="w-full gap-2" 
                    onClick={() => {
                      setSelectedNotificationForDetail(null);
                      navigate(`/instruments?search=${encodeURIComponent(match[1])}`);
                    }}
                  >
                    <Search className="h-4 w-4" />
                    View Instrument in Inventory
                  </Button>
                </div>
              );
            }
            return null;
          })()}
        </DialogContent>
      </Dialog>

      {/* Detailed Progress Dialog */}
      <Dialog open={!!selectedJobForDetail} onOpenChange={(open) => !open && setSelectedJobForDetail(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span>Upload Progress Details</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Real-time processing status of your master list upload.
            </DialogDescription>
          </DialogHeader>

          {selectedJobForDetail && (() => {
            // Find the live job in state to show live updates!
            const liveJob = jobs.find(j => j.id === selectedJobForDetail.id) || selectedJobForDetail;
            const pct = liveJob.totalRows > 0 ? Math.round((liveJob.processedRows / liveJob.totalRows) * 100) : 0;
            
            return (
              <div className="flex-1 overflow-y-auto space-y-5 py-4">
                {/* File & Global Stats */}
                <div className="bg-muted/30 border rounded-lg p-4 space-y-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-foreground truncate pr-2" title={liveJob.fileName}>{liveJob.fileName}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Started: {liveJob.created_at ? new Date(liveJob.created_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {liveJob.status === "processing" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-[10px] px-2.5 bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelJob(liveJob.id);
                          }}
                          disabled={isCancellingId === liveJob.id}
                        >
                          {isCancellingId === liveJob.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Cancel Upload
                        </Button>
                      )}
                      <Badge variant={
                        liveJob.status === "completed" ? "default" :
                        liveJob.status === "processing" ? "secondary" :
                        liveJob.status === "cancelled" ? "outline" : "destructive"
                      } className="capitalize text-[10px] px-2 py-0.5">
                        {liveJob.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Overall Progress ({liveJob.processedRows} of {liveJob.totalRows} rows)</span>
                      <span className="font-bold text-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
                    <div>
                      <span className="block text-xs font-bold text-foreground">{liveJob.totalRows}</span>
                      <span className="text-[9px] text-muted-foreground">Total Rows</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-green-600">{liveJob.successCount}</span>
                      <span className="text-[9px] text-muted-foreground">Saved Successfully</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-red-500">{liveJob.failedCount}</span>
                      <span className="text-[9px] text-muted-foreground">Failed / Errors</span>
                    </div>
                  </div>
                </div>

                {/* Download Actions */}
                {liveJob.status === "completed" && liveJob.failedCount > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400">Failed rows template is ready</h5>
                      <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                        Download and correct the {liveJob.failedCount} failed rows and re-upload.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-[11px] px-3 shadow flex items-center justify-center"
                      disabled={isDownloadingJobId === liveJob.id}
                      onClick={(e) => handleDownloadFailed(e, liveJob)}
                    >
                      {isDownloadingJobId === liveJob.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <DownloadCloudIcon className="h-3.5 w-3.5" />
                      )}
                      Download Failed
                    </Button>
                  </div>
                )}

                {/* Error Log Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Errors / Validation Log</span>
                    <Badge variant="outline" className="text-[9px] font-normal">{liveJob.errors?.length || 0} issues</Badge>
                  </h4>
                  
                  <div className="border rounded-lg overflow-hidden bg-background">
                    <div className="max-h-48 overflow-y-auto divide-y text-xs">
                      {!liveJob.errors || liveJob.errors.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-[11px]">
                          No validation errors logged.
                        </div>
                      ) : (
                        liveJob.errors.map((errItem: any, idx: number) => (
                          <div key={idx} className="p-2.5 hover:bg-muted/20 transition-colors flex items-start gap-2.5">
                            <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground mt-0.5">
                              Row {errItem.row}
                            </span>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground text-[10px]">ID Code:</span>
                                <span className="font-mono text-muted-foreground text-[10px]">{errItem.id_code || "N/A"}</span>
                              </div>
                              <p className="text-red-500 text-[10px] font-medium leading-normal pr-2">
                                {errItem.error}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </header>
  );
}
