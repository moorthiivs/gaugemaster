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
import { ExternalLink, ZoomIn, ZoomOut, RotateCcw, FileText, Image as ImageIcon } from "lucide-react";

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

  const isPdf =
    fileType?.toLowerCase().includes("pdf") ||
    filePath.toLowerCase().endsWith(".pdf") ||
    documentName?.toLowerCase().endsWith(".pdf");

  const isImage =
    fileType?.toLowerCase().includes("image") ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filePath) ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(documentName || "");

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const handleOpenExternal = () => {
    window.open(filePath, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden bg-background">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3 pr-6">
          <div className="flex flex-col gap-1.5 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              {isPdf ? (
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
              src={filePath}
              title={documentName || "PDF Document"}
              className="w-full h-full min-h-[550px] border-0 rounded-md bg-white shadow-xs"
            />
          ) : isImage ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={filePath}
                alt={documentName || "Document Image"}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-w-full max-h-full object-contain rounded-md shadow-sm transition-transform duration-150"
              />
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
