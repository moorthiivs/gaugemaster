import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, Crown, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function SidebarTrialCard() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const companyAccess = user?.companyAccess;
  const isTimeLimited = companyAccess?.status === "time_limited";
  const startDateStr = companyAccess?.startDate;
  const expiryDateStr = companyAccess?.expiryDate;

  useEffect(() => {
    if (user?.companyId) {
      const isHidden = sessionStorage.getItem(`dismiss_sidebar_trial_${user.companyId}`) === "true";
      setDismissed(isHidden);
    }
  }, [user?.companyId]);

  if (!isTimeLimited || !expiryDateStr || dismissed || user?.isSuperAdmin) {
    return null;
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const expiryDate = new Date(expiryDateStr);
  const now = new Date();

  const totalDurationMs = Math.max(1, expiryDate.getTime() - startDate.getTime());
  const elapsedMs = Math.max(0, now.getTime() - startDate.getTime());
  const usedPercentage = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

  const diffMs = expiryDate.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isWarning = remainingDays <= 7;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    if (user?.companyId) {
      sessionStorage.setItem(`dismiss_sidebar_trial_${user.companyId}`, "true");
    }
  };

  const handleUpgrade = () => {
    window.open("mailto:support@gaugemaster.com?subject=Upgrade%20Trial%20Subscription", "_blank");
  };

  return (
    <div className="px-1 my-1 group-data-[collapsible=icon]:px-1">
      {/* Expanded Full Card */}
      <div
        className={cn(
          "group-data-[collapsible=icon]:hidden relative overflow-hidden rounded-2xl p-4 border shadow-sm transition-all duration-300 hover:shadow-md backdrop-blur-sm",
          isWarning
            ? "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/10 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-red-950/30 border-amber-500/30 dark:border-amber-500/40"
            : "bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-blue-950/30 border-indigo-500/20 dark:border-indigo-500/30"
        )}
      >
        {/* Subtle Ambient Glowing Orb */}
        <div
          className={cn(
            "absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl pointer-events-none opacity-60",
            isWarning ? "bg-amber-500/30" : "bg-indigo-500/30"
          )}
        />

        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isWarning ? "bg-amber-400" : "bg-indigo-400"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isWarning ? "bg-amber-500" : "bg-indigo-600 dark:bg-indigo-400"
                )}
              />
            </span>
            <span
              className={cn(
                "text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full border",
                isWarning
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
              )}
            >
              {isWarning ? "Expiring Soon" : "Free Trial"}
            </span>
          </div>

          <button
            onClick={handleDismiss}
            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Hide trial card"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Main Metric Row */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xl font-extrabold text-foreground tracking-tight">{remainingDays}</span>
              <span className="text-xs font-semibold text-muted-foreground ml-1">days remaining</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground/80 bg-background/60 dark:bg-black/30 px-1.5 py-0.5 rounded border border-border/40">
              {usedPercentage}% used
            </span>
          </div>

          {/* Custom Styled Progress Bar */}
          <div className="w-full bg-black/5 dark:bg-white/10 h-2 rounded-full overflow-hidden p-[1px]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isWarning
                  ? "bg-gradient-to-r from-amber-500 to-red-500 shadow-xs shadow-amber-500/50"
                  : "bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 shadow-xs shadow-indigo-500/50"
              )}
              style={{ width: `${usedPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 opacity-70" />
              Expires {format(expiryDate, "dd MMM yyyy")}
            </span>
          </div>
        </div>

        {/* Action Upgrade Button */}
        <Button
          onClick={handleUpgrade}
          size="sm"
          className="w-full h-9 mt-3 text-xs font-bold gap-2 relative z-10 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-300 group/btn border-0 rounded-xl cursor-pointer"
        >
          <Crown className="h-3.5 w-3.5 fill-amber-200 text-amber-200 group-hover/btn:rotate-12 group-hover/btn:scale-110 transition-transform" />
          <span>Upgrade Plan</span>
          <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-70 group-hover/btn:translate-x-0.5 transition-transform" />
        </Button>
      </div>

      {/* Collapsed Icon Mode Button */}
      <button
        onClick={handleUpgrade}
        className={cn(
          "hidden group-data-[collapsible=icon]:flex relative items-center justify-center h-10 w-10 mx-auto rounded-xl transition-all duration-300 group/icon border shadow-xs cursor-pointer",
          isWarning
            ? "bg-gradient-to-br from-amber-500/20 to-red-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:scale-105"
            : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:scale-105"
        )}
        title={`Trial: ${remainingDays} days remaining (Expires ${format(expiryDate, "dd MMM yyyy")}) — Click to Upgrade`}
      >
        <Crown className="h-4 w-4 fill-current group-hover/icon:rotate-12 transition-transform" />
        <span
          className={cn(
            "absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-extrabold text-white shadow-xs",
            isWarning ? "bg-amber-600" : "bg-indigo-600"
          )}
        >
          {remainingDays}
        </span>
      </button>
    </div>
  );
}
