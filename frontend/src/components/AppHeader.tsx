import { useState, useEffect, useRef } from "react";
import { Bell, LogOut, Moon, Search, Settings, Sun, User, User as UserIcon, Loader2, CheckCircle2, XCircle, DownloadCloudIcon, AlertCircle, FileSpreadsheet, Mail, AlertTriangle, Trash2, LayoutDashboard, Wrench, PlusCircle, BarChart3, CalendarDays } from "lucide-react";
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

const headerItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Instruments", url: "/instruments", icon: Wrench },
  { title: "Add Instrument", url: "/instruments/new", icon: PlusCircle },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
];

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { themeSettings, saveTheme } = useThemeSettings();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isDownloadingJobId, setIsDownloadingJobId] = useState<string | null>(null);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<UploadJob | null>(null);
  const [selectedNotificationForDetail, setSelectedNotificationForDetail] = useState<AppNotification | null>(null);
  
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
      const latestJobs = res.data;
      const latestNotifs = notifRes.data;

      // Detect unread notifications
      if (latestNotifs.some(n => !n.is_read)) {
        setHasUnread(true);
      }

      // 1. Detect if any job has just finished processing
      if (previousJobsCountRef.current !== null) {
        latestJobs.forEach(job => {
          const wasActive = activeJobsRef.current.includes(job.id);
          const isDone = job.status === "completed" || job.status === "failed";
          
          if (wasActive && isDone) {
            setHasUnread(true);
            if (job.status === "completed") {
              toast({
                title: "Upload Completed! 🎉",
                description: `Successfully processed "${job.fileName}". ${job.successCount} saved, ${job.failedCount} failed.`,
              });
              window.dispatchEvent(new CustomEvent("background-upload-completed"));
            } else {
              toast({
                title: "Upload Failed ❌",
                description: `Could not process "${job.fileName}". Please try again.`,
                variant: "destructive",
              });
            }
          }
        });
      }

      // Update refs
      activeJobsRef.current = latestJobs.filter(j => j.status === "processing").map(j => j.id);
      previousJobsCountRef.current = latestJobs.length;

      setJobs(latestJobs);
      setNotifications(latestNotifs);
    } catch (err) {
      console.error("Error fetching background tasks and notifications:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll every 3 seconds always to keep background task sync perfectly updated in real-time
    const interval = setInterval(() => {
      fetchJobs(true);
    }, 3000);

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
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="h-14 flex items-center gap-3 px-4">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <div className="font-semibold hidden sm:block">Calibration Alerts</div>
        <div className="hidden lg:flex items-center gap-1 ml-6">
          {headerItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* <div className="hidden md:flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Input placeholder="Search instruments…" aria-label="Search instruments" className="w-64" />
          </div> */}
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}>
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="h-5 w-5 hidden dark:block" />
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
              <DropdownMenuItem onClick={() => navigate("/profile")}>Profile</DropdownMenuItem>
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
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
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
