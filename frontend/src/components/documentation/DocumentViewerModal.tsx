import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  CheckCircle2,
} from "lucide-react";
import { getSecureFileUrl, downloadFileFromUrl, isExcelFile } from "@/lib/tokenStorage";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentName?: string;
  idCode?: string;
  partName?: string;
  filePath?: string;
  fileType?: string;
  version?: number;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  title,
  documentName,
  idCode,
  partName,
  filePath,
  fileType,
  version,
}: DocumentViewerModalProps) {
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !filePath) return null;

  const authenticatedFilePath = getSecureFileUrl(filePath);

  const isExcel = isExcelFile(filePath, documentName, fileType);

  const isPdf =
    !isExcel &&
    (fileType?.toLowerCase().includes("pdf") ||
      filePath.toLowerCase().endsWith(".pdf") ||
      documentName?.toLowerCase().endsWith(".pdf"));

  const isImage =
    !isExcel &&
    !isPdf &&
    (fileType?.toLowerCase().includes("image") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filePath) ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(documentName || ""));

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const handleOpenExternal = () => {
    window.open(authenticatedFilePath, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    downloadFileFromUrl(filePath, documentName || "document.xlsx");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden bg-background">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3 pr-6">
          <div className="flex flex-col gap-1.5 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              {isExcel ? (
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isPdf ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
              )}
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                {title}
              </DialogTitle>
              {version !== undefined && (
                <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                  v{version}
                </Badge>
              )}
              {isExcel && (
                <Badge variant="outline" className="text-[11px] font-mono shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  Spreadsheet
                </Badge>
              )}
              {idCode && (
                <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                  ID: {idCode}
                </Badge>
              )}
              {partName && (
                <Badge variant="secondary" className="text-[11px] shrink-0 bg-primary/10 text-primary">
                  Part: {partName}
                </Badge>
              )}
            </div>
            {documentName && (
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {documentName}
              </DialogDescription>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && (
              <div className="flex items-center border rounded-md px-1 bg-muted/40 mr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono w-10 text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 dark:text-emerald-400"
              onClick={handleDownload}
              title="Download file to your local computer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleOpenExternal}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open in New Tab</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg bg-muted/30 border p-2 flex items-center justify-center min-h-[400px] max-h-[70vh]">
          {isPdf ? (
            <iframe
              src={authenticatedFilePath}
              title={documentName || "PDF Document"}
              className="w-full h-full min-h-[550px] border-0 rounded-md bg-white shadow-xs"
            />
          ) : isImage ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={authenticatedFilePath}
                alt={documentName || "Document Image"}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-w-full max-h-full object-contain rounded-md shadow-sm transition-transform duration-150"
              />
            </div>
          ) : isExcel ? (
            <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center p-6 text-center space-y-5 bg-card/60 rounded-xl border border-emerald-500/20">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-inner">
                  <FileSpreadsheet className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 text-[10px] font-bold font-mono bg-emerald-600 text-white rounded-md shadow-xs">
                  EXCEL
                </span>
              </div>

              <div className="space-y-1.5 max-w-md">
                <h4 className="text-base font-bold text-foreground">
                  {documentName || "Excel Spreadsheet Document"}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Excel files (.xlsx, .xls, .csv) are downloaded to your local computer so you can view and edit them in Microsoft Excel or your preferred spreadsheet app.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Ready to download & view locally
                </Badge>
                {version !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    Revision v{version}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md px-5"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Download to View in Excel
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleOpenExternal}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open via Browser
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">Document Preview</p>
              <p className="text-xs text-muted-foreground">
                This document format may require opening externally.
              </p>
              <Button onClick={handleOpenExternal} size="sm">
                Open Document
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
