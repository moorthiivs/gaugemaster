import React from "react";
import { Loader2 } from "lucide-react";

export default function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-8 space-y-4 animate-in fade-in-50 duration-300">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 animate-ping absolute" />
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center bg-background/80 shadow-xs">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-foreground tracking-wide uppercase">
          Loading Module
        </p>
        <p className="text-[11px] text-muted-foreground">
          Preparing workspace and calibration data...
        </p>
      </div>
    </div>
  );
}
