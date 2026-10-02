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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, FileSpreadsheet } from "lucide-react";
import { Instrument } from "@/types/instrument";
import httpClient, { API_URL } from "@/lib/httpClient";

const BASE_URL = (httpClient.defaults.baseURL || API_URL || "/api").replace(/\/api\/?$/, "");

interface InstrumentsHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Instrument | null;
  historyData: any[];
  loadingHistory: boolean;
}

export function InstrumentsHistoryModal({
  isOpen,
  onOpenChange,
  instrument,
  historyData,
  loadingHistory,
}: InstrumentsHistoryModalProps) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const getSecureFileUrl = (filePath: string) => {
    let fullUrl = filePath.startsWith("http") ? filePath : `${BASE_URL}${filePath}`;
    if (fullUrl.includes("/uploads/") && token && !fullUrl.includes("token=")) {
      fullUrl = `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
    }
    return fullUrl;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Calibration History
          </DialogTitle>
          <DialogDescription>
            Audit trail for {instrument?.name} ({instrument?.id_code})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history records found for this instrument.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Updated On</TableHead>
                    <TableHead>Last Calibration</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.created_at ? new Date(record.created_at).toLocaleString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        {record.last_calibration_date
                          ? new Date(record.last_calibration_date).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {record.due_date ? new Date(record.due_date).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            record.calibration_source === "In-House"
                              ? "bg-blue-50 text-blue-700"
                              : record.calibration_source === "External"
                              ? "bg-amber-50 text-amber-700"
                              : ""
                          }
                        >
                          {record.calibration_source || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.certificate_file ? (
                          <a
                            href={getSecureFileUrl(record.certificate_file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center text-sm"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
