import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Shield,
  ShieldCheck,
  AlertCircle,
  Activity,
  ArrowRight,
} from "lucide-react";

export interface CalibrationWorkflowHoverCardProps {
  children: React.ReactNode;
  status?: string | null;
  subStatus?: string | null;
  openDelay?: number;
  closeDelay?: number;
  align?: "center" | "start" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function CalibrationWorkflowHoverCard({
  children,
  status = "Under Calibration",
  subStatus,
  openDelay = 100,
  closeDelay = 150,
  align = "center",
  side = "top",
  className,
}: CalibrationWorkflowHoverCardProps) {
  // Normalize stage
  const rawSub = (subStatus || "").trim().toLowerCase();
  const rawStatus = (status || "").trim().toLowerCase();

  const isApproved =
    rawStatus === "ok" ||
    rawStatus === "approved" ||
    rawStatus === "calibrated" ||
    rawSub === "approved";

  const isApprovePending =
    !isApproved &&
    (rawSub.includes("approve") ||
      rawSub === "pending approval" ||
      rawSub === "reviewed");

  const isReviewPending = !isApproved && !isApprovePending; // default for in-flight / Step 1 completed

  // Stage details for header & contextual box
  let currentStepNumber = 2;
  let currentStagePill = "Stage 2: Review Pending";
  let stageTitle = "Awaiting Technical Review";
  let stageDescription =
    "Calibration measurements & certificate draft submitted. Awaiting verification in Calibration Approval.";

  if (isApprovePending) {
    currentStepNumber = 3;
    currentStagePill = "Stage 3: Approve Pending";
    stageTitle = "Awaiting Final Quality Approval";
    stageDescription =
      "Technical review completed. Awaiting Quality Manager sign-off to finalize certificate & mark instrument OK.";
  } else if (isApproved) {
    currentStepNumber = 3;
    currentStagePill = "Completed: Approved";
    stageTitle = "Calibration Lifecycle Complete";
    stageDescription =
      "All verification and approvals completed. Instrument is active and fully compliant.";
  }

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-pointer select-none">
          {children}
        </span>
      </HoverCardTrigger>

      <HoverCardContent
        align={align}
        side={side}
        sideOffset={8}
        className={cn(
          "w-[370px] p-4 bg-popover/98 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl text-popover-foreground z-[100000] space-y-3.5",
          className
        )}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-foreground tracking-tight">
              Calibration Pipeline
            </span>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
              isApproved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full mr-1.5",
                isApproved
                  ? "bg-emerald-500"
                  : "bg-amber-500 animate-pulse"
              )}
            />
            {currentStagePill}
          </Badge>
        </div>

        {/* Stepper Graphic */}
        <div className="pt-1 px-1">
          <div className="flex items-center justify-between relative">
            {/* ── STEP 1: CALIBRATION (Always Completed in Under Calibration) ── */}
            <div className="flex flex-col items-center w-24 shrink-0 z-10 text-center">
              <div className="relative flex items-center justify-center">
                <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/40 ring-2 ring-emerald-500/20">
                  <Check className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <span className="mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                Calibration
              </span>
              <span className="text-[9.5px] font-medium text-emerald-600/75 dark:text-emerald-400/75">
                Completed
              </span>
            </div>

            {/* ── CONNECTOR 1 -> 2 ── */}
            <div className="flex-1 h-1 mx-1.5 rounded-full overflow-hidden relative self-center -mt-6">
              {isApproved || isApprovePending ? (
                // Solid green when step 2 is also done
                <div className="w-full h-full bg-emerald-500" />
              ) : (
                // Animated gradient when transitioning to Review Pending
                <div className="w-full h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 relative">
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              )}
            </div>

            {/* ── STEP 2: REVIEW PENDING (Warning when active, Green when done) ── */}
            <div className="flex flex-col items-center w-28 shrink-0 z-10 text-center">
              {isApprovePending || isApproved ? (
                // Completed Review
                <div className="relative flex items-center justify-center">
                  <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/40 ring-2 ring-emerald-500/20">
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                // Active Review Pending with pulsing radar ping
                <div className="relative flex items-center justify-center">
                  <span className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping duration-1000" />
                  <div className="relative h-7 w-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-amber-500/35 ring-2 ring-amber-500/30">
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                </div>
              )}

              <span
                className={cn(
                  "mt-1.5 text-[11px] font-bold leading-tight",
                  isApprovePending || isApproved
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {isApprovePending || isApproved ? "Reviewed" : "Review Pending"}
              </span>
              <span
                className={cn(
                  "text-[9.5px] font-medium leading-tight",
                  isApprovePending || isApproved
                    ? "text-emerald-600/75 dark:text-emerald-400/75"
                    : "text-amber-600/80 dark:text-amber-400/80 font-semibold"
                )}
              >
                {isApprovePending || isApproved ? "Verified OK" : "In Verification"}
              </span>
            </div>

            {/* ── CONNECTOR 2 -> 3 ── */}
            <div className="flex-1 h-1 mx-1.5 rounded-full overflow-hidden relative self-center -mt-6">
              {isApproved ? (
                // Solid green when finished
                <div className="w-full h-full bg-emerald-500" />
              ) : isApprovePending ? (
                // Active gradient from emerald to amber
                <div className="w-full h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 relative">
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              ) : (
                // Upcoming muted line
                <div className="w-full h-full bg-muted-foreground/20 dark:bg-muted/40" />
              )}
            </div>

            {/* ── STEP 3: APPROVAL (Muted upcoming, Warning if active, Green if approved) ── */}
            <div className="flex flex-col items-center w-24 shrink-0 z-10 text-center">
              {isApproved ? (
                <div className="relative flex items-center justify-center">
                  <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/40 ring-2 ring-emerald-500/20">
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
              ) : isApprovePending ? (
                // Active Approve Pending with pulsing radar ping
                <div className="relative flex items-center justify-center">
                  <span className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping duration-1000" />
                  <div className="relative h-7 w-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-amber-500/35 ring-2 ring-amber-500/30">
                    <ShieldCheck className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                </div>
              ) : (
                // Upcoming Approval
                <div className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/35 bg-muted/30 text-muted-foreground/60 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5" />
                </div>
              )}

              <span
                className={cn(
                  "mt-1.5 text-[11px] font-bold leading-tight",
                  isApproved
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isApprovePending
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground/80 font-medium"
                )}
              >
                {isApproved ? "Approved" : "Approval"}
              </span>
              <span
                className={cn(
                  "text-[9.5px] font-medium leading-tight",
                  isApproved
                    ? "text-emerald-600/75 dark:text-emerald-400/75"
                    : isApprovePending
                    ? "text-amber-600/80 dark:text-amber-400/80 font-semibold"
                    : "text-muted-foreground/50"
                )}
              >
                {isApproved
                  ? "Active"
                  : isApprovePending
                  ? "Awaiting Sign-off"
                  : "Pending"}
              </span>
            </div>
          </div>
        </div>

        {/* Action / Context Info Box */}
        <div
          className={cn(
            "rounded-lg p-2.5 flex items-start gap-2.5 border text-left transition-colors",
            isApproved
              ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25"
              : "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25"
          )}
        >
          <div
            className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              isApproved
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            )}
          >
            {isApproved ? (
              <Check className="h-3 w-3 stroke-[2.5]" />
            ) : isApprovePending ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight">
              {stageTitle}
            </p>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {stageDescription}
            </p>
          </div>
        </div>

        {/* Micro-footer */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Status: <strong className="text-foreground">Under Calibration</strong>
          </span>
          <span className="font-mono text-muted-foreground/75">
            Step {currentStepNumber} of 3
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default CalibrationWorkflowHoverCard;
