import React from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  CalendarDays,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Instrument } from "@/types/instrument";
import { useNavigate } from "react-router-dom";
import { getSecureFileUrl } from "@/lib/tokenStorage";

export interface InstrumentsHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Instrument | null;
  historyData: any[];
  loadingHistory: boolean;
  onViewCertificate?: (calIdOrCertNo: string, record: any) => void;
}

export function InstrumentsHistoryModal({
  isOpen,
  onOpenChange,
  instrument,
  historyData,
  loadingHistory,
  onViewCertificate,
}: InstrumentsHistoryModalProps) {
  const navigate = useNavigate();

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return format(d, "dd-MMM-yyyy");
    } catch {
      return null;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return { date: "—", time: "" };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: "—", time: "" };
      return {
        date: format(d, "dd-MMM-yyyy"),
        time: format(d, "hh:mm a"),
      };
    } catch {
      return { date: "—", time: "" };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 border rounded-xl shadow-xl">
        {/* Header */}
        <div className="p-5 border-b bg-muted/20">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">
                Calibration History & Audit Trail
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Chronological calibration logs, certification records, and compliance cycle tracking.
              </DialogDescription>
            </div>
          </div>

          {/* Instrument Context Card */}
          {instrument && (
            <div className="mt-3.5 rounded-lg border bg-background/80 dark:bg-background/40 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="min-w-0">
                <span className="font-semibold text-foreground truncate block">
                  {instrument.name}
                </span>
                <span className="text-muted-foreground  text-[11px]">
                  ID Code: <span className="font-medium text-foreground">{instrument.id_code}</span>
                  {instrument.location ? ` • ${instrument.location}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <Badge variant="outline" className="text-[10px]  px-2 py-0.5 bg-muted/40">
                  {historyData.length} {historyData.length === 1 ? "Record" : "Records"}
                </Badge>
                {instrument.due_date && (
                  <div className="text-[11px]  text-muted-foreground flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                    Due: {formatDate(instrument.due_date) || "—"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5">
          {loadingHistory ? (
            <div className="space-y-2.5 py-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2.5 border border-dashed rounded-xl bg-muted/15">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <History className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-foreground">No calibration records logged yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Use "Log External Calibration" or the in-house calibration workflow to register calibration events for this instrument.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-2xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">
                      Updated On
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">
                      Calibration Date
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">
                      Next Due Date
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">
                      Source
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5 text-right">
                      Certificate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((record) => {
                    const dt = formatDateTime(record.created_at);
                    const calDate = formatDate(record.last_calibration_date || record.calibration_date);
                    const dueDate = formatDate(record.due_date || record.next_calibration_date);
                    const certNo = record.certificate_number || record.cert_no;
                    const certFile = record.certificate_file;

                    return (
                      <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs text-foreground">{dt.date}</span>
                            {dt.time && (
                              <span className="text-[10px] text-muted-foreground">{dt.time}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-foreground font-medium">
                          {calDate || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-foreground font-medium">
                          {dueDate || "—"}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {record.calibration_source === "In-House" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium inline-flex items-center gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            >
                              <Layers className="w-3 h-3" />
                              In-House
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium inline-flex items-center gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            >
                              <ExternalLink className="w-3 h-3" />
                              External
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {certFile ? (
                            <a
                              href={getSecureFileUrl(certFile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20 transition-all shadow-2xs"
                              title="Open uploaded certificate in new tab"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate max-w-[120px]">{certNo || "View File"}</span>
                              <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                            </a>
                          ) : certNo ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (onViewCertificate) {
                                  onViewCertificate(record.calibration_id || certNo, record);
                                } else if (instrument?.id) {
                                  onOpenChange(false);
                                  navigate(`/calibration/history/${instrument.id}`);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold  border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-2xs cursor-pointer"
                              title="Preview digital certificate"
                            >
                              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[120px]">{certNo}</span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-2">
          {instrument?.id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/calibration/history/${instrument.id}`);
              }}
              className="text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/5 h-9"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Full History & Reports
            </Button>
          ) : (
            <div />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 px-4 font-medium"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
