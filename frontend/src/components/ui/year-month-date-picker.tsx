import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface YearMonthDatePickerProps {
  value?: string; // yyyy-MM-dd
  onChange: (dateStr: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
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

export function YearMonthDatePicker({
  value,
  onChange,
  className,
  disabled = false,
  placeholder = "Pick a date",
}: YearMonthDatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = parseISO(value.includes("T") ? value.split("T")[0] : value);
    return isValid(d) ? d : null;
  }, [value]);

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
    const baseYear = new Date().getFullYear();
    const start = baseYear - 15;
    const end = baseYear + 20;
    const years: number[] = [];
    for (let y = start; y <= end; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const formattedDisplay = parsedDate ? format(parsedDate, "PPP") : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 text-xs bg-background border-input hover:border-primary/50 transition-all gap-2 shadow-sm",
            !parsedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="truncate font-medium">{formattedDisplay}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 bg-popover border shadow-lg rounded-xl" align="start">
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
              <SelectContent className="max-h-48">
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
              <SelectContent className="max-h-48">
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
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
