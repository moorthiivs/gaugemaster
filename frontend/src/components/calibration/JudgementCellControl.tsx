import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface JudgementCellControlProps {
  value: string | undefined | null;
  onChange: (newValue: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

const STANDARD_OPTIONS = ["OK", "NOT OK", "PASS", "FAIL", "Normal"] as const;

export const JudgementCellControl: React.FC<JudgementCellControlProps> = ({
  value,
  onChange,
  disabled = false,
  className = "",
  size = "sm",
}) => {
  const normalizedVal = value !== undefined && value !== null ? String(value).trim() : "OK";
  const upperVal = normalizedVal.toUpperCase();

  // Find if normalizedVal matches any standard option (case-insensitive)
  const matchedStandard = STANDARD_OPTIONS.find(
    (opt) => opt.toUpperCase() === upperVal
  );

  const [isCustomMode, setIsCustomMode] = useState<boolean>(!matchedStandard && normalizedVal !== "");
  const [customText, setCustomText] = useState<string>(!matchedStandard ? normalizedVal : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!matchedStandard && normalizedVal !== "") {
      setIsCustomMode(true);
      setCustomText(normalizedVal);
    } else if (matchedStandard && !isCustomMode) {
      setCustomText(matchedStandard);
    }
  }, [normalizedVal, matchedStandard]);

  useEffect(() => {
    if (isCustomMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCustomMode]);

  // Styling based on current value
  const isPass = upperVal === "PASS" || upperVal === "OK";
  const isFail = upperVal === "FAIL" || upperVal === "NOT OK" || upperVal === "REJECT";
  const isNormal = upperVal === "NORMAL";

  const getStyleClasses = () => {
    if (isPass) {
      return "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 font-bold";
    }
    if (isFail) {
      return "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700 font-bold";
    }
    if (isNormal) {
      return "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700 font-bold";
    }
    return "bg-amber-50/70 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 font-semibold";
  };

  const heightClass = size === "sm" ? "h-7 text-xs" : "h-8 text-sm";

  if (isCustomMode) {
    return (
      <div className={`flex items-center gap-1 w-full min-w-[110px] ${className}`}>
        <Input
          ref={inputRef}
          type="text"
          value={customText}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            setCustomText(v);
            onChange(v);
          }}
          placeholder="Custom judgement..."
          className={`${heightClass} font-semibold text-center border px-1.5 rounded transition-colors ${getStyleClasses()} flex-1 focus-visible:ring-1`}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setIsCustomMode(false);
            const fallback = "OK";
            onChange(fallback);
          }}
          className="h-7 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0 rounded"
          title="Switch back to standard options (OK, NOT OK, etc.)"
        >
          <List className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // Display standard shadcn select
  const selectValue = matchedStandard || "OK";

  return (
    <div className={`relative inline-block w-full min-w-[95px] ${className}`}>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(val) => {
          if (val === "__CUSTOM__") {
            setIsCustomMode(true);
            setCustomText(normalizedVal && !matchedStandard ? normalizedVal : "");
          } else {
            onChange(val);
          }
        }}
      >
        <SelectTrigger
          className={`w-full ${heightClass} px-2 py-0 cursor-pointer text-center rounded border outline-none transition-colors focus:ring-1 focus:ring-primary/40 ${getStyleClasses()}`}
        >
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="OK" className="font-bold text-emerald-700">OK</SelectItem>
          <SelectItem value="NOT OK" className="font-bold text-rose-700">NOT OK</SelectItem>
          <SelectItem value="PASS" className="font-bold text-emerald-700">PASS</SelectItem>
          <SelectItem value="FAIL" className="font-bold text-rose-700">FAIL</SelectItem>
          <SelectItem value="Normal" className="font-bold text-sky-700">Normal</SelectItem>
          <SelectItem value="__CUSTOM__" className="font-semibold text-amber-700">✎ Custom...</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
