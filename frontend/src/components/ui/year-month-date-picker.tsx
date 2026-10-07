import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, isValid, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface YearMonthDatePickerProps {
  value?: string | Date | null;
  onChange: (dateStr: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  formatPattern?: string; // e.g. "dd-MMM-yyyy", "dd-MM-yyyy", "PPP"
  outputFormat?: string; // e.g. "yyyy-MM-dd"
  clearable?: boolean;
  align?: "start" | "center" | "end";
}

const MONTHS = [
  { value: 1, label: "January (01)" },
  { value: 2, label: "February (02)" },
  { value: 3, label: "March (03)" },
  { value: 4, label: "April (04)" },
  { value: 5, label: "May (05)" },
  { value: 6, label: "June (06)" },
  { value: 7, label: "July (07)" },
  { value: 8, label: "August (08)" },
  { value: 9, label: "September (09)" },
  { value: 10, label: "October (10)" },
  { value: 11, label: "November (11)" },
  { value: 12, label: "December (12)" },
];

/**
 * Robust date parser supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD-MMM-YYYY, ISO strings, and Date objects.
 * Prevents UTC midnight rollover timezone bugs by creating local date objects.
 */
export function parseFlexibleDate(val?: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isValid(val) ? val : null;
  if (typeof val !== "string") return null;
  const str = val.trim();
  if (!str || str === "-" || str === "N/A" || str === "null" || str === "undefined") return null;

  // 1. Direct match for YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const dateObj = new Date(y, m, d);
    if (isValid(dateObj) && !isNaN(dateObj.getTime())) return dateObj;
  }

  // 2. Direct match for DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dateObj = new Date(y, m, d);
    if (isValid(dateObj) && !isNaN(dateObj.getTime())) return dateObj;
  }

  // 3. Common named month formats like 19-Feb-2027 or 19 Feb 2027
  const namedFormats = ["dd-MMM-yyyy", "dd-MMM-yy", "d-MMM-yyyy", "dd MMM yyyy", "yyyy/MM/dd", "MM/dd/yyyy"];
  for (const fmt of namedFormats) {
    try {
      const parsed = parse(str, fmt, new Date());
      if (isValid(parsed) && !isNaN(parsed.getTime())) return parsed;
    } catch {
      // ignore & try next
    }
  }

  // 4. ISO parse fallback
  try {
    const iso = parseISO(str);
    if (isValid(iso) && !isNaN(iso.getTime())) return iso;
  } catch {
    // ignore
  }

  // 5. JavaScript Date fallback
  try {
    const nativeDate = new Date(str);
    if (isValid(nativeDate) && !isNaN(nativeDate.getTime())) return nativeDate;
  } catch {
    // ignore
  }

  return null;
}

export function YearMonthDatePicker({
  value,
  onChange,
  className,
  disabled = false,
  placeholder = "Pick a date",
  formatPattern = "dd-MMM-yyyy",
  outputFormat = "yyyy-MM-dd",
  clearable = true,
  align = "start",
}: YearMonthDatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsedDate = useMemo(() => parseFlexibleDate(value), [value]);

  const [viewYear, setViewYear] = useState<number>(
    parsedDate ? parsedDate.getFullYear() : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedDate ? parsedDate.getMonth() + 1 : new Date().getMonth() + 1
  );

  // Sync internal view month/year when value changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth() + 1);
    }
  }, [parsedDate]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = currentYear - 20;
    const end = currentYear + 25;
    const years: number[] = [];
    for (let y = start; y <= end; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const formattedDisplay = useMemo(() => {
    if (!parsedDate) return placeholder;
    try {
      return format(parsedDate, formatPattern);
    } catch {
      return placeholder;
    }
  }, [parsedDate, formatPattern, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={className?.includes("h-8") || className?.includes("h-7") ? "sm" : "default"}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal text-sm bg-background border-input hover:border-primary/50 transition-all gap-2 shadow-xs px-3",
            !className?.includes("h-") && "h-9",
            !parsedDate && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formattedDisplay}</span>
          </div>
          {clearable && parsedDate && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="p-0.5 rounded-sm hover:bg-muted text-muted-foreground/60 hover:text-foreground shrink-0 transition-colors cursor-pointer -mr-1"
              title="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 bg-popover border shadow-xl rounded-xl z-50" align={align}>
        {/* Quick Month and Year Selection Header */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b">
          <div className="flex-1">
            <Select
              value={String(viewMonth)}
              onValueChange={(val) => setViewMonth(Number(val))}
            >
              <SelectTrigger className="h-8 text-xs font-medium bg-muted/40 border-muted">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-48 z-50">
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Select
              value={String(viewYear)}
              onValueChange={(val) => setViewYear(Number(val))}
            >
              <SelectTrigger className="h-8 text-xs font-medium bg-muted/40 border-muted">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-48 z-50">
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs font-medium">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* DayPicker Calendar Grid */}
        <CalendarPicker
          mode="single"
          month={new Date(viewYear, viewMonth - 1, 1)}
          onMonthChange={(d) => {
            if (d) {
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth() + 1);
            }
          }}
          selected={parsedDate || undefined}
          onSelect={(d: Date | undefined) => {
            if (d) {
              onChange(format(d, outputFormat));
              setOpen(false);
            }
          }}
          initialFocus
        />

        {/* Footer shortcuts: Today & Clear */}
        <div className="flex items-center justify-between pt-2 border-t mt-1 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange(format(new Date(), outputFormat));
              setOpen(false);
            }}
          >
            Today
          </Button>
          {clearable && parsedDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const DatePicker = YearMonthDatePicker;
export type DatePickerProps = YearMonthDatePickerProps;
export default YearMonthDatePicker;
