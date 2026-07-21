import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
    Download, Trash2, Play, Clock, HardDrive, Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Cloud, CloudOff, ExternalLink
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const API = "/api";

/** Parse a UTC timestamp from the API and return a dayjs in local timezone */
function toLocal(dateStr: string) {
    // new Date() natively converts UTC ISO strings (ending in Z) to local time
    return dayjs(new Date(dateStr));
}

interface BackupRecord {
    id: string;
    companyId: string;
    triggeredBy: string | null;
    type: string;
    status: string;
    fileName: string | null;
    fileSizeBytes: number | null;
    storageType: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
}

interface BackupScheduleData {
    id?: string;
    companyId: string;
    enabled: boolean;
    frequency: string;
    timeOfDay: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    retentionDays: number;
    storageType: string;
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "completed":
            return <Badge variant="default" className="bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
        case "in_progress":
            return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> In Progress</Badge>;
        case "failed":
            return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
        case "pending":
            return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Pending</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function BackupSettings() {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const companyId = user?.companyId;

    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [schedule, setSchedule] = useState<BackupScheduleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [backingUp, setBackingUp] = useState(false);
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [pollingActive, setPollingActive] = useState(false);

    // Google Drive state
    const [driveStatus, setDriveStatus] = useState<{ enabled: boolean; connected: boolean; email?: string }>({ enabled: false, connected: false });
    const [connectingDrive, setConnectingDrive] = useState(false);

    const headers = { Authorization: `Bearer ${token}` };

    // ─── FETCH DATA ─────────────────────────────────────────────

    const fetchBackups = useCallback(async () => {
        if (!companyId) return;
        try {
            const res = await axios.get(`${API}/backup/list?companyId=${companyId}`, { headers });
            setBackups(res.data);

            // Check if any backup is in progress
            const hasInProgress = res.data.some((b: BackupRecord) => b.status === "in_progress" || b.status === "pending");
            setPollingActive(hasInProgress);
        } catch {
            // silent
        }
    }, [companyId, token]);

    const fetchSchedule = useCallback(async () => {
        if (!companyId) return;
        try {
            const res = await axios.get(`${API}/backup/schedule?companyId=${companyId}`, { headers });
            setSchedule(res.data || null);
        } catch {
            setSchedule(null);
        }
    }, [companyId, token]);

    const fetchDriveStatus = useCallback(async () => {
        if (!companyId) return;
        try {
            const res = await axios.get(`${API}/backup/drive/status?companyId=${companyId}`, { headers });
            setDriveStatus(res.data);
        } catch {
            setDriveStatus({ enabled: false, connected: false });
        }
    }, [companyId, token]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            await Promise.all([fetchBackups(), fetchSchedule(), fetchDriveStatus()]);
            setLoading(false);
        }
        load();
    }, [fetchBackups, fetchSchedule, fetchDriveStatus]);

    // Check URL params for Drive connection result
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const driveResult = params.get('drive');
        if (driveResult === 'connected') {
            toast({ title: "Google Drive Connected", description: "Backups will now be uploaded to your Google Drive." });
            fetchDriveStatus();
            // Clean URL
            window.history.replaceState({}, '', '/settings');
        } else if (driveResult === 'error') {
            toast({ title: "Google Drive Connection Failed", description: params.get('message') || 'Unknown error', variant: "destructive" });
            window.history.replaceState({}, '', '/settings');
        }
    }, []);

    // Poll for in-progress backups
    useEffect(() => {
        if (!pollingActive) return;
        const interval = setInterval(fetchBackups, 3000);
        return () => clearInterval(interval);
    }, [pollingActive, fetchBackups]);

    // ─── INSTANT BACKUP ─────────────────────────────────────────

    const handleBackupNow = async () => {
        if (!companyId) return;
        setBackingUp(true);
        try {
            await axios.post(`${API}/backup/now`, { companyId, userId: user?.id }, { headers });
            toast({ title: "Backup Started", description: "Your database backup is being created..." });
            setPollingActive(true);
            await fetchBackups();
        } catch (err: any) {
            toast({ title: "Backup Failed", description: err?.response?.data?.message || "Could not start backup.", variant: "destructive" });
        } finally {
            setBackingUp(false);
        }
    };

    // ─── DOWNLOAD ───────────────────────────────────────────────

    const handleDownload = async (backup: BackupRecord) => {
        try {
            const res = await axios.get(
                `${API}/backup/download/${backup.id}?companyId=${companyId}`,
                { headers, responseType: "blob" }
            );
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = backup.fileName || "backup.sql.gz";
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast({ title: "Download Failed", variant: "destructive" });
        }
    };

    // ─── DELETE ──────────────────────────────────────────────────

    const handleDelete = async (backupId: string) => {
        try {
            await axios.delete(`${API}/backup/${backupId}?companyId=${companyId}`, { headers });
            toast({ title: "Backup Deleted" });
            await fetchBackups();
        } catch {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    // ─── SCHEDULE SAVE ──────────────────────────────────────────

    const handleSaveSchedule = async () => {
        if (!companyId || !schedule) return;
        setSavingSchedule(true);
        try {
            const payload = { ...schedule, companyId };
            const res = await axios.post(`${API}/backup/schedule`, payload, { headers });
            setSchedule(res.data);
            toast({ title: "Schedule Saved", description: `Backups will run ${schedule.frequency} at ${schedule.timeOfDay}` });
        } catch (err: any) {
            toast({ title: "Save Failed", description: err?.response?.data?.message || "Could not save schedule.", variant: "destructive" });
        } finally {
            setSavingSchedule(false);
        }
    };

    // ─── GOOGLE DRIVE ────────────────────────────────────────────

    const handleConnectDrive = async () => {
        if (!companyId) return;
        setConnectingDrive(true);
        try {
            const res = await axios.get(`${API}/backup/drive/auth-url?companyId=${companyId}`, { headers });
            if (res.data.url) {
                window.location.href = res.data.url;
            } else {
                toast({ title: "Error", description: res.data.error || "Could not generate auth URL", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setConnectingDrive(false);
        }
    };

    const handleDisconnectDrive = async () => {
        if (!companyId) return;
        try {
            await axios.delete(`${API}/backup/drive/disconnect?companyId=${companyId}`, { headers });
            setDriveStatus({ enabled: driveStatus.enabled, connected: false });
            toast({ title: "Google Drive Disconnected" });
        } catch {
            toast({ title: "Disconnect Failed", variant: "destructive" });
        }
    };

    // ─── DEFAULT SCHEDULE ───────────────────────────────────────

    const initSchedule = (): BackupScheduleData => ({
        companyId: companyId || "",
        enabled: true,
        frequency: "daily",
        timeOfDay: "02:00",
        retentionDays: 7,
        storageType: "local",
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const currentSchedule = schedule || initSchedule();

    return (
        <div className="space-y-8">
            {/* ───── Header + Instant Backup ───── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Database Backup</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create instant backups or configure automatic scheduled backups
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchBackups}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                    </Button>
                    <Button onClick={handleBackupNow} disabled={backingUp}>
                        {backingUp ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                            <><Play className="h-4 w-4 mr-2" /> Backup Now</>
                        )}
                    </Button>
                </div>
            </div>

            <Separator />

            {/* ───── Schedule Configuration ───── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Scheduled Backup
                            </CardTitle>
                            <CardDescription>Automatically back up your database at regular intervals</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="schedule-enabled" className="text-sm">Enable</Label>
                            <Switch
                                id="schedule-enabled"
                                checked={currentSchedule.enabled}
                                onCheckedChange={(checked) =>
                                    setSchedule({ ...currentSchedule, enabled: checked })
                                }
                            />
                        </div>
                    </div>
                </CardHeader>
                {currentSchedule.enabled && (
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Frequency */}
                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select
                                    value={currentSchedule.frequency}
                                    onValueChange={(val) =>
                                        setSchedule({ ...currentSchedule, frequency: val })
                                    }
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Time of Day */}
                            <div className="space-y-2">
                                <Label>Time (IST)</Label>
                                <Input
                                    type="time"
                                    value={currentSchedule.timeOfDay}
                                    onChange={(e) =>
                                        setSchedule({ ...currentSchedule, timeOfDay: e.target.value })
                                    }
                                />
                            </div>

                            {/* Conditional: Day of Week */}
                            {currentSchedule.frequency === "weekly" && (
                                <div className="space-y-2">
                                    <Label>Day of Week</Label>
                                    <Select
                                        value={String(currentSchedule.dayOfWeek ?? 0)}
                                        onValueChange={(val) =>
                                            setSchedule({ ...currentSchedule, dayOfWeek: Number(val) })
                                        }
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                                                <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Conditional: Day of Month */}
                            {currentSchedule.frequency === "monthly" && (
                                <div className="space-y-2">
                                    <Label>Day of Month</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={28}
                                        value={currentSchedule.dayOfMonth ?? 1}
                                        onChange={(e) =>
                                            setSchedule({ ...currentSchedule, dayOfMonth: Number(e.target.value) })
                                        }
                                    />
                                </div>
                            )}

                            {/* Retention */}
                            <div className="space-y-2">
                                <Label>Keep backups for (days)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={currentSchedule.retentionDays}
                                    onChange={(e) =>
                                        setSchedule({ ...currentSchedule, retentionDays: Number(e.target.value) })
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
                                {savingSchedule ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                                ) : (
                                    "Save Schedule"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* ───── Google Drive Connection ───── */}
            {driveStatus.enabled && (
                <Card className={driveStatus.connected
                    ? "border-blue-500/30 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20"
                    : ""
                }>
                    <CardContent className="py-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Google Drive Icon */}
                                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                                    driveStatus.connected
                                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25"
                                        : "bg-muted"
                                }`}>
                                    <Cloud className={`h-6 w-6 ${driveStatus.connected ? "text-white" : "text-muted-foreground"}`} />
                                </div>

                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-base">Google Drive</h3>
                                        {driveStatus.connected && (
                                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {driveStatus.connected
                                            ? <><span className="font-medium text-foreground">{driveStatus.email}</span> — backups are automatically uploaded to Drive</>
                                            : "Connect your Google account to automatically upload backups to the cloud"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                {driveStatus.connected ? (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors">
                                                <CloudOff className="h-4 w-4 mr-1" /> Disconnect
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    New backups will no longer be uploaded to Google Drive. Existing backups in Drive will remain.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDisconnectDrive}>Disconnect</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                ) : (
                                    <Button onClick={handleConnectDrive} disabled={connectingDrive} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                                        {connectingDrive ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                                        ) : (
                                            <><ExternalLink className="h-4 w-4 mr-2" /> Connect Google Drive</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ───── Backup History ───── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <HardDrive className="h-4 w-4" /> Backup History
                    </CardTitle>
                    <CardDescription>
                        {backups.length} backup{backups.length !== 1 ? "s" : ""} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {backups.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No backups yet. Click <strong>"Backup Now"</strong> to create your first backup.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Storage</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {backups.map((backup) => (
                                        <TableRow key={backup.id}>
                                            <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                                {backup.fileName || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize text-xs">
                                                    {backup.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={backup.status} />
                                            </TableCell>
                                            <TableCell>
                                                {backup.storageType === 'google_drive' ? (
                                                    <Badge variant="outline" className="gap-1 text-xs text-blue-600"><Cloud className="h-3 w-3" /> Drive</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1 text-xs"><HardDrive className="h-3 w-3" /> Local</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {backup.fileSizeBytes ? formatBytes(backup.fileSizeBytes) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {toLocal(backup.createdAt).format("DD MMM YYYY, HH:mm")}
                                                <br />
                                                <span className="text-xs">{toLocal(backup.createdAt).fromNow()}</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    {backup.status === "completed" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDownload(backup)}
                                                            title="Download"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" title="Delete">
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will permanently delete the backup file <strong>{backup.fileName}</strong>. This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(backup.id)}>
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
