import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw, Upload, Check, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureCanvasProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  className?: string;
}

export function SignatureCanvas({ value, onChange, className }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(value || null);

  useEffect(() => {
    if (value) {
      setPreviewImage(value);
    }
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set background to white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
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
    setPreviewImage(null);
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
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
    exportCanvas();
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    setHasDrawn(false);
    setPreviewImage(null);
    saveState();
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
    exportCanvas();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewImage(dataUrl);
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <PenTool className="h-3.5 w-3.5 text-primary" /> Draw Digital Signature
        </label>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length <= 1 && !previewImage}
            className="h-7 px-2 text-[11px] gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
          >
            <Eraser className="h-3 w-3" /> Clear
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded-md hover:bg-muted transition-colors">
              <Upload className="h-3 w-3" /> Upload Image
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

      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center min-h-[140px]">
        {previewImage ? (
          <div className="relative w-full h-[140px] flex items-center justify-center p-2 bg-white">
            <img
              src={previewImage}
              alt="Signature Preview"
              className="max-h-full max-w-full object-contain"
            />
            <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Check className="h-3 w-3" /> Saved Signature
            </div>
          </div>
        ) : (
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
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center italic">
        Use your mouse, stylus, or finger to draw your official signature inside the box above.
      </p>
    </div>
  );
}
