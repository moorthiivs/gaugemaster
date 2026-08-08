import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, AlertCircle, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function TrialAlertBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const companyAccess = user?.companyAccess;
  const isTimeLimited = companyAccess?.status === "time_limited";
  const expiryDateStr = companyAccess?.expiryDate;

  useEffect(() => {
    if (user?.companyId) {
      const isHidden = sessionStorage.getItem(`dismiss_trial_banner_${user.companyId}`) === "true";
      setDismissed(isHidden);
    }
  }, [user?.companyId]);

  if (!isTimeLimited || !expiryDateStr || dismissed || user?.isSuperAdmin) {
    return null;
  }

  const expiryDate = new Date(expiryDateStr);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isWarning = remainingDays <= 7;

  const handleDismiss = () => {
    setDismissed(true);
    if (user?.companyId) {
      sessionStorage.setItem(`dismiss_trial_banner_${user.companyId}`, "true");
    }
  };

  return (
    <div
      className={`w-full px-4 py-2 text-xs flex items-center justify-between gap-3 border-b shadow-2xs transition-all ${
        isWarning
          ? "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30"
          : "bg-blue-500/10 text-blue-900 dark:text-blue-300 border-blue-500/20"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isWarning ? (
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        )}
        <span className="font-bold truncate">
          {isWarning ? "Trial Expiring Soon:" : "Trial Period Active:"}
        </span>
        <span className="truncate">
          <strong>{remainingDays} days remaining</strong> (Expires on{" "}
          <span className="font-semibold">{format(expiryDate, "dd MMM yyyy")}</span>)
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/10"
          onClick={handleDismiss}
          title="Hide banner for this session"
        >
          <X className="h-3.5 w-3.5 mr-1" /> Hide
        </Button>
      </div>
    </div>
  );
}
