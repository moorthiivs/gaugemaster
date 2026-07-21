import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface VerdictBadgeProps {
  verdict: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable verdict badge with color-coded icons for PASS/FAIL/CONDITIONAL.
 */
export function VerdictBadge({ verdict, size = "md" }: VerdictBadgeProps) {
  const upper = (verdict || "").toUpperCase();
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  if (upper === "PASS") {
    return (
      <Badge className={`bg-emerald-500/15 text-emerald-600 border-emerald-300 hover:bg-emerald-500/20 gap-1.5 ${sizeClasses[size]}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        PASS
      </Badge>
    );
  }

  if (upper === "FAIL") {
    return (
      <Badge className={`bg-red-500/15 text-red-600 border-red-300 hover:bg-red-500/20 gap-1.5 ${sizeClasses[size]}`}>
        <XCircle className="w-3.5 h-3.5" />
        FAIL
      </Badge>
    );
  }

  return (
    <Badge className={`bg-amber-500/15 text-amber-600 border-amber-300 hover:bg-amber-500/20 gap-1.5 ${sizeClasses[size]}`}>
      <AlertTriangle className="w-3.5 h-3.5" />
      {upper || "PENDING"}
    </Badge>
  );
}
