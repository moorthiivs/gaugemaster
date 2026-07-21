import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Activity, CheckCircle2, XCircle, FileText, Download, TrendingUp, Clock, Eye, Trash2 } from "lucide-react";
import { listCalibrations, getCalibrationStats, downloadCertificate, getAllDrafts, deleteDraft } from "@/lib/calibrationActions";
import { CalibrationRecord, CalibrationStats, CALIBRATION_TYPES } from "@/types/calibration";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { format } from "date-fns";

export default function Calibration() {
  useSEO({ title: "Calibration — GaugeMaster", description: "Calibrate instruments and generate certificates" });
  const navigate = useNavigate();
  const { user } = useAuth();

  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [stats, setStats] = useState<CalibrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [verdictFilter, setVerdictFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const pageSize = 10;

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [calData, statsData, draftData] = await Promise.all([
        listCalibrations({
          userId: user.id,
          verdict: verdictFilter !== "All" ? verdictFilter : undefined,
          calibrationType: typeFilter !== "All" ? typeFilter : undefined,
          page,
          pageSize,
        }),
        getCalibrationStats(user.id),
        getAllDrafts(user.id).catch(() => []),
      ]);
      setCalibrations(calData.data || []);
      setDrafts(draftData || []);
      setTotal(calData.total || 0);
      setStats(statsData);
    } catch {
      toast.error("Failed to load calibrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, page, verdictFilter, typeFilter]);

  const handleDownload = async (cal: CalibrationRecord) => {
    try {
      const blob = await downloadCertificate(cal.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cal.certificate_number?.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Certificate not available for download");
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6 py-6 px-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Calibration
          </h1>
          <p className="text-sm text-muted-foreground">Calibrate instruments and generate professional certificates</p>
        </div>
        <Button onClick={() => navigate("/calibration/new")} className="gap-2 shadow-lg">
          <PlusCircle className="w-4 h-4" />
          New Calibration
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/15"><Activity className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Calibrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.passRate}%</p>
                  <p className="text-xs text-muted-foreground">Pass Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/15"><XCircle className="w-5 h-5 text-red-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/15"><Clock className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingCerts}</p>
                  <p className="text-xs text-muted-foreground">Pending Certificates</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instrument Type Quick Links */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {CALIBRATION_TYPES.map((ct) => (
          <Button
            key={ct.type}
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-3 text-xs hover:border-primary/50"
            onClick={() => navigate(`/calibration/new`)}
          >
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{ct.label}</span>
          </Button>
        ))}
      </div>

      {/* Filters & Table */}
      <Tabs defaultValue="recent" className="w-full">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="recent">Recent Calibrations</TabsTrigger>
                <TabsTrigger value="drafts">
                  Unfinished Drafts
                  {drafts.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-200">
                      {drafts.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Select value={verdictFilter} onValueChange={setVerdictFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Verdict" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Verdicts</SelectItem>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                    <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {CALIBRATION_TYPES.map((ct) => (
                      <SelectItem key={ct.type} value={ct.type}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <TabsContent value="recent" className="mt-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : calibrations.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Certificate No</TableHead>
                        <TableHead className="text-xs">Instrument</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Verdict</TableHead>
                        <TableHead className="text-xs">ULR</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calibrations.map((cal) => (
                        <TableRow key={cal.id}>
                          <TableCell className="font-mono text-xs font-medium">{cal.certificate_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium">{cal.instrument?.name || "-"}</p>
                              <p className="text-[10px] text-muted-foreground">{cal.instrument?.id_code || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {cal.calibration_type || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(cal.calibration_date)}</TableCell>
                          <TableCell><VerdictBadge verdict={cal.verdict} size="sm" /></TableCell>
                          <TableCell className="text-xs font-mono">{cal.ulr_number || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {cal.certificate_generated ? (
                                <Button variant="ghost" size="sm" onClick={() => handleDownload(cal)} className="gap-1 text-xs h-7">
                                  <Download className="w-3 h-3" />
                                  PDF
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground px-2">No cert</span>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => navigate(`/calibration/history/${cal.instrument_id || cal.instrument?.id}`)} 
                                className="gap-1 text-xs h-7 text-primary hover:text-primary/80"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No calibrations found</p>
                <Button onClick={() => navigate("/calibration/new")} className="mt-4 gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Start First Calibration
                </Button>
              </div>
            )}
          </TabsContent>

          {/* DRAFTS TAB */}
          <TabsContent value="drafts" className="mt-4">
            {drafts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Instrument</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Last Saved</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((draft) => {
                      let parsedData = draft.data;
                      if (typeof parsedData === "string") {
                        try { parsedData = JSON.parse(parsedData); } catch (e) {}
                      }
                      const inst = parsedData?.selectedInstrument;
                      const typeLabel = parsedData?.selectedType?.label || "-";
                      
                      return (
                        <TableRow key={draft.id}>
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium">{inst?.name || "Unknown Instrument"}</p>
                              <p className="text-[10px] text-muted-foreground">{inst?.id_code || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {typeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {draft.updated_at ? format(new Date(draft.updated_at.replace("Z", "")), "dd-MMM-yyyy hh:mm a") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="h-7 text-xs px-3"
                                onClick={() => navigate(`/calibration/new?draftId=${draft.id}`)}
                              >
                                Resume
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteDraft(draft.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">No pending drafts</p>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Card>
      </Tabs>
    </div>
  );
}
