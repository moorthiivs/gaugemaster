import React, { useState, useEffect } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon, Filter, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { YearMonthDatePicker } from "@/components/ui/year-month-date-picker";
import { InstrumentQuery } from "@/types/instrument";
import { cn } from "@/lib/utils";

interface InstrumentDateFilterProps {
  filters: InstrumentQuery;
  onApplyDateFilter: (updatedFilters: Partial<InstrumentQuery>) => void;
  onClearDateFilter: () => void;
}

export function InstrumentDateFilter({
  filters,
  onApplyDateFilter,
  onClearDateFilter,
}: InstrumentDateFilterProps) {
  const [open, setOpen] = useState(false);

  // Field: "due" | "last_cal"
  const [dateField, setDateField] = useState<"due" | "last_cal">("due");
  // Mode: "single" | "range"
  const [mode, setMode] = useState<"single" | "range">("single");

  // Dates
  const [singleDate, setSingleDate] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Determine active state from props
  const isDueDateActive = Boolean(filters.due_date || filters.due_date_start || filters.due_date_end);
  const isLastCalActive = Boolean(filters.last_cal_start || filters.last_cal_end);
  const isAnyDateActive = isDueDateActive || isLastCalActive;

  // Initialize form state whenever popover opens or filters change
  useEffect(() => {
    if (isLastCalActive) {
      setDateField("last_cal");
      if (filters.last_cal_start && filters.last_cal_end && filters.last_cal_start === filters.last_cal_end) {
        setMode("single");
        setSingleDate(filters.last_cal_start);
        setFromDate("");
        setToDate("");
      } else {
        setMode("range");
        setFromDate(filters.last_cal_start || "");
        setToDate(filters.last_cal_end || "");
        setSingleDate("");
      }
    } else if (isDueDateActive) {
      setDateField("due");
      const dSingle = filters.due_date || (filters.due_date_start && filters.due_date_start === filters.due_date_end ? filters.due_date_start : "");
      if (dSingle) {
        setMode("single");
        setSingleDate(dSingle);
        setFromDate("");
        setToDate("");
      } else {
        setMode("range");
        setFromDate(filters.due_date_start || "");
        setToDate(filters.due_date_end || "");
        setSingleDate("");
      }
    } else {
      // Default state if nothing active
      setDateField("due");
      setMode("single");
      setSingleDate("");
      setFromDate("");
      setToDate("");
    }
  }, [open, filters]);

  const handleApply = () => {
    const update: Partial<InstrumentQuery> = {
      due_date: "",
      due_date_start: "",
      due_date_end: "",
      last_cal_start: "",
      last_cal_end: "",
      page: 1,
    };

    if (dateField === "due") {
      if (mode === "single" && singleDate) {
        update.due_date = singleDate;
        update.due_date_start = singleDate;
        update.due_date_end = singleDate;
      } else if (mode === "range") {
        update.due_date_start = fromDate;
        update.due_date_end = toDate;
      }
    } else {
      if (mode === "single" && singleDate) {
        update.last_cal_start = singleDate;
        update.last_cal_end = singleDate;
      } else if (mode === "range") {
        update.last_cal_start = fromDate;
        update.last_cal_end = toDate;
      }
    }

    onApplyDateFilter(update);
    setOpen(false);
  };

  const handlePreset = (type: "today" | "next7" | "next30" | "last7" | "last30" | "thisMonth") => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    if (type === "today") {
      setMode("single");
      setSingleDate(todayStr);
    } else if (type === "thisMonth") {
      setMode("range");
      const start = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      const end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
      setFromDate(start);
      setToDate(end);
    } else if (type === "next7") {
      setMode("range");
      const next7 = new Date();
      next7.setDate(now.getDate() + 7);
      setFromDate(todayStr);
      setToDate(format(next7, "yyyy-MM-dd"));
    } else if (type === "next30") {
      setMode("range");
      const next30 = new Date();
      next30.setDate(now.getDate() + 30);
      setFromDate(todayStr);
      setToDate(format(next30, "yyyy-MM-dd"));
    } else if (type === "last7") {
      setMode("range");
      const last7 = new Date();
      last7.setDate(now.getDate() - 7);
      setFromDate(format(last7, "yyyy-MM-dd"));
      setToDate(todayStr);
    } else if (type === "last30") {
      setMode("range");
      const last30 = new Date();
      last30.setDate(now.getDate() - 30);
      setFromDate(format(last30, "yyyy-MM-dd"));
      setToDate(todayStr);
    }
  };

  // Format date display for Trigger Button
  const formatLabelDate = (dStr: string) => {
    if (!dStr) return "";
    try {
      const parsed = parseISO(dStr);
      return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : dStr;
    } catch {
      return dStr;
    }
  };

  let activeDisplayText = "Date Filter";
  if (isDueDateActive) {
    const sDate = filters.due_date || filters.due_date_start;
    const eDate = filters.due_date_end;
    if (sDate && eDate && sDate === eDate) {
      activeDisplayText = `Due: ${formatLabelDate(sDate)}`;
    } else if (sDate || eDate) {
      activeDisplayText = `Due: ${formatLabelDate(sDate || "Any")} - ${formatLabelDate(eDate || "Any")}`;
    }
  } else if (isLastCalActive) {
    const sDate = filters.last_cal_start;
    const eDate = filters.last_cal_end;
    if (sDate && eDate && sDate === eDate) {
      activeDisplayText = `Last Cal: ${formatLabelDate(sDate)}`;
    } else if (sDate || eDate) {
      activeDisplayText = `Last Cal: ${formatLabelDate(sDate || "Any")} - ${formatLabelDate(eDate || "Any")}`;
    }
  }

  return (
    <div className="w-full sm:w-[160px] md:w-[180px]">
      <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <CalendarIcon className="h-3.5 w-3.5 text-primary" /> Date Filter
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full justify-between text-xs bg-background border-border/70 rounded-lg px-2.5 font-normal transition-all",
              isAnyDateActive && "border-primary/50 bg-primary/10 font-bold text-primary shadow-xs"
            )}
          >
            <span className="flex items-center gap-1.5 truncate">
              <CalendarIcon className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", isAnyDateActive && "text-primary")} />
              <span className="truncate">{activeDisplayText}</span>
            </span>
            {isAnyDateActive ? (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearDateFilter();
                }}
                className="ml-1 text-muted-foreground hover:text-red-600 font-bold p-0.5 rounded"
                title="Clear date filter"
              >
                <X className="h-3 w-3" />
              </span>
            ) : (
              <Filter className="h-3 w-3 text-muted-foreground shrink-0 opacity-60" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[320px] p-4 bg-popover border border-border/80 shadow-xl rounded-xl z-[100]" align="start">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-primary" /> Filter by Date
              </span>
              {isAnyDateActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearDateFilter();
                    setOpen(false);
                  }}
                  className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            {/* Field Selection: Due Date vs Last Calibration Date */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Filter Target</Label>
              <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDateField("due")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md font-bold transition-all text-center",
                    dateField === "due" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Due Date
                </button>
                <button
                  type="button"
                  onClick={() => setDateField("last_cal")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md font-bold transition-all text-center",
                    dateField === "last_cal" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Last Cal Date
                </button>
              </div>
            </div>

            {/* Mode Selection: Single Date vs Date Range */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Picker Mode</Label>
              <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md font-bold transition-all text-center",
                    mode === "single" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Single Date
                </button>
                <button
                  type="button"
                  onClick={() => setMode("range")}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md font-bold transition-all text-center",
                    mode === "range" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Date Range
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("today")} className="h-6 text-[10px] px-2 rounded-md">
                  Today
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("thisMonth")} className="h-6 text-[10px] px-2 rounded-md">
                  This Month
                </Button>
                {dateField === "due" ? (
                  <>
                    <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("next7")} className="h-6 text-[10px] px-2 rounded-md">
                      Next 7 Days
                    </Button>
                    <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("next30")} className="h-6 text-[10px] px-2 rounded-md">
                      Next 30 Days
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("last7")} className="h-6 text-[10px] px-2 rounded-md">
                      Last 7 Days
                    </Button>
                    <Button variant="outline" size="sm" type="button" onClick={() => handlePreset("last30")} className="h-6 text-[10px] px-2 rounded-md">
                      Last 30 Days
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Date Pickers */}
            {mode === "single" ? (
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Select Date</Label>
                <YearMonthDatePicker
                  value={singleDate}
                  onChange={(val) => setSingleDate(val)}
                  placeholder={`Select ${dateField === "due" ? "Due Date" : "Last Cal Date"}`}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">From Date</Label>
                  <YearMonthDatePicker
                    value={fromDate}
                    onChange={(val) => setFromDate(val)}
                    placeholder="From Date"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">To Date</Label>
                  <YearMonthDatePicker
                    value={toDate}
                    onChange={(val) => setToDate(val)}
                    placeholder="To Date"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="flex-1 h-8 text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={(mode === "single" && !singleDate) || (mode === "range" && !fromDate && !toDate)}
                className="flex-1 h-8 text-xs font-bold bg-primary text-primary-foreground rounded-lg gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
