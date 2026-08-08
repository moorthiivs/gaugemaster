import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, ShieldAlert, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";

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

  return (
    <div className="px-3 my-2 group-data-[collapsible=icon]:px-1">
      {/* Full expanded card matching modern storage/trial card design */}
      <div className="group-data-[collapsible=icon]:hidden relative rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 p-3 shadow-2xs hover:shadow-xs transition-all">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1.5 right-1.5 h-5 w-5 text-muted-foreground hover:text-foreground rounded-md"
          onClick={handleDismiss}
          title="Hide trial card"
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <div className="space-y-2 pr-3">
          <div className="flex items-center gap-1.5">
            {isWarning ? (
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
            ) : (
              <Clock className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-bold tracking-tight text-sidebar-foreground truncate">
              {isWarning ? "Trial Expiring Soon" : "Trial Period"}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{remainingDays} days remaining</span>
              <span className="text-[10px] font-mono font-bold text-sidebar-foreground">{usedPercentage}% used</span>
            </div>
            <Progress value={usedPercentage} className={`h-1.5 ${isWarning ? "[&>div]:bg-amber-500" : "[&>div]:bg-primary"}`} />
          </div>

          <p className="text-[10px] text-muted-foreground font-medium">
            Expires on <span className="font-semibold text-sidebar-foreground">{format(expiryDate, "dd MMM yyyy")}</span>
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[11px] font-bold gap-1.5 mt-1 bg-background hover:bg-primary/10 hover:text-primary border-sidebar-border/80 shadow-2xs"
            onClick={() => window.open("mailto:support@gaugemaster.com?subject=Upgrade%20Trial%20Subscription", "_blank")}
          >
            <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {/* Collapsed Icon Mode Tooltip / Badge */}
      <div
        className="hidden group-data-[collapsible=icon]:flex items-center justify-center p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary cursor-pointer"
        title={`Trial: ${remainingDays} days remaining (Expires ${format(expiryDate, "dd MMM yyyy")})`}
      >
        <Clock className="h-4 w-4" />
      </div>
    </div>
  );
}
