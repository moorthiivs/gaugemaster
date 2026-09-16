import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Eye, FileText, Image as ImageIcon, Calendar, User, Clock } from "lucide-react";

interface HistoryItem {
  id: string;
  version: number;
  process?: string;
  gauge_name?: string;
  title?: string;
  id_code?: string;
  part_name?: string;
  instrument_id?: string;
  procedure_id?: string;
  diagram_id?: string;
  instruction_id?: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  action_details?: string;
  created_by_name?: string;
  created_at: string;
}

interface DocumentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string; // e.g. "Calibration Procedure", "Gauge Diagram", "Work Instruction"
  itemName: string; // e.g. "Calibration of Vernier Caliper"
  itemId: string;
  historyList: HistoryItem[];
  isLoading: boolean;
  onViewDocument: (item: HistoryItem) => void;
}

export function DocumentHistoryModal({
  isOpen,
  onClose,
  entityName,
  itemName,
  itemId,
  historyList,
  isLoading,
  onViewDocument,
}: DocumentHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {entityName} Revision History
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Target: <span className="font-semibold text-foreground">{itemName}</span> &bull; ID: <span className="font-mono text-[11px]">{itemId}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto my-2 rounded-md border">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-16 font-semibold">Version</TableHead>
                <TableHead className="font-semibold">Document / File</TableHead>
                <TableHead className="font-semibold">Action / Revision Details</TableHead>
                <TableHead className="font-semibold">Updated By</TableHead>
                <TableHead className="font-semibold">Date & Time</TableHead>
                <TableHead className="text-right font-semibold">Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    Loading revision history...
                  </TableCell>
                </TableRow>
              ) : historyList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    No history entries found.
                  </TableCell>
                </TableRow>
              ) : (
                historyList.map((entry) => {
                  const isPdf =
                    entry.file_type?.toLowerCase().includes("pdf") ||
                    entry.document_name?.toLowerCase().endsWith(".pdf");

                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">
                        <Badge variant="outline" className="font-bold">
                          v{entry.version}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isPdf ? (
                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-xs font-medium max-w-[220px] truncate" title={entry.document_name}>
                              {entry.document_name || "No document"}
                            </span>
                            {entry.file_type && (
                              <span className="text-[10px] text-muted-foreground">
                                {entry.file_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                        <div>{entry.action_details || "Record updated"}</div>
                        {(entry.id_code || entry.part_name) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {entry.id_code && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground font-semibold">
                                ID: {entry.id_code}
                              </span>
                            )}
                            {entry.part_name && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                Part: {entry.part_name}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">{entry.created_by_name || "User"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 opacity-70" />
                          <span>
                            {entry.created_at
                              ? format(new Date(entry.created_at), "dd MMM yyyy, hh:mm a")
                              : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.file_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1 hover:text-primary"
                            onClick={() => onViewDocument(entry)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No file</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
