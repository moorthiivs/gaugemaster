import { StatusBadge } from "@/components/common/StatusBadge";

interface VerdictBadgeProps {
  verdict: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Reusable verdict badge with color-coded icons for PASS/FAIL/CONDITIONAL.
 */
export function VerdictBadge({ verdict, size = "md", className }: VerdictBadgeProps) {
  const mappedSize = size === "lg" ? "md" : size === "sm" ? "xs" : "sm";
  return (
    <StatusBadge
      status={verdict}
      category="verdict"
      size={mappedSize}
      className={className}
    />
  );
}
