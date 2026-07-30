import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eraser, RotateCcw, Upload, Check, PenTool, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureCanvasProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  initials?: string;
  onInitialsChange?: (initials: string) => void;
  className?: string;
}

export function SignatureCanvas({
  value,
  onChange,
  initials: initialInitialsProp = "",
  onInitialsChange,
  className,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [isSaved, setIsSaved] = useState(Boolean(value));
  const [initials, setInitials] = useState(initialInitialsProp);

  useEffect(() => {
    setInitials(initialInitialsProp);
  }, [initialInitialsProp]);

  // Initialize canvas & load existing value image if present
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill background white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
        setIsSaved(true);
      };
      img.src = value;
    } else {
      saveState();
    }
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, imageData]);
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawn(true);
    setIsSaved(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(x, y, 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#0f172a"; // Deep navy ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveState();
    if (autoSave) {
      exportCanvas();
    }
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
    setIsSaved(true);
  };

  const handleManualSave = () => {
    exportCanvas();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blankData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([blankData]);
    setHasDrawn(false);
    setIsSaved(false);
    setInitials("");
    if (onInitialsChange) onInitialsChange("");
    onChange("");
  };

  const handleUndo = () => {
    if (history.length <= 1) {
      handleClear();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // remove current state
    const previousState = newHistory[newHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setHistory(newHistory);
    
    if (newHistory.length <= 1) {
      setHasDrawn(false);
      setIsSaved(false);
      onChange("");
    } else if (autoSave) {
      exportCanvas();
    } else {
      setIsSaved(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
        exportCanvas();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleInitialsChange = (val: string) => {
    setInitials(val);
    if (onInitialsChange) {
      onInitialsChange(val);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with Title */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <PenTool className="h-3.5 w-3.5 text-primary" /> Draw Digital Signature
        </label>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-1.5 rounded-lg border">
        {/* Auto-Save Toggle */}
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="auto-save-sig"
            checked={autoSave}
            onCheckedChange={(checked) => setAutoSave(Boolean(checked))}
            className="h-3.5 w-3.5"
          />
          <Label htmlFor="auto-save-sig" className="text-[11px] font-medium cursor-pointer text-muted-foreground">
            Auto-save on completion
          </Label>
        </div>

        {/* Buttons: Save, Undo, Clear, Upload */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleManualSave}
            disabled={!hasDrawn && history.length <= 1}
            className="h-7 px-2.5 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-3 w-3" /> Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="h-7 px-2 text-[11px] gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <Eraser className="h-3 w-3" /> Clear
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded-md hover:bg-muted transition-colors bg-background">
              <Upload className="h-3 w-3" /> Upload
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center min-h-[140px]">
        {isSaved && (
          <div className="absolute top-2 right-2 z-10 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Check className="h-3 w-3" /> Signature Saved
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={480}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[140px] cursor-crosshair touch-none bg-white"
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-center italic">
        Use your mouse, stylus, or finger to draw your official signature inside the box above.
      </p>
    </div>
  );
}
