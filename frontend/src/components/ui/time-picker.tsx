import React, { useState, useEffect, useMemo } from "react";
import { Clock, Check, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // e.g. "08:30" or "08:30:00"
  onChange: (timeStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  withSeconds?: boolean;
}

const COMMON_PRESETS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "13:00", "14:00", "15:00",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

export function TimePicker({
  value = "",
  onChange,
  placeholder = "Select time",
  className,
  disabled = false,
  withSeconds = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse current value
  const { hour, minute, second } = useMemo(() => {
    if (!value) return { hour: "08", minute: "00", second: "00" };
    const parts = value.split(":").map((p) => p.trim());
    return {
      hour: parts[0] ? parts[0].padStart(2, "0") : "08",
      minute: parts[1] ? parts[1].padStart(2, "0") : "00",
      second: parts[2] ? parts[2].padStart(2, "0") : "00",
    };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState(hour);
  const [selectedMinute, setSelectedMinute] = useState(minute);
  const [selectedSecond, setSelectedSecond] = useState(second);

  useEffect(() => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedSecond(second);
  }, [hour, minute, second, open]);

  const handleApply = (h: string, m: string, s?: string) => {
    const formatted = withSeconds
      ? `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(s || "00").padStart(2, "0")}`
      : `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    onChange(formatted);
  };

  const handlePresetSelect = (preset: string) => {
    const formatted = withSeconds ? `${preset}:00` : preset;
    onChange(formatted);
    setOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    handleApply(h, m, s);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const hoursList = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutesList = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  const secondsList = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative group flex items-center w-full">
        <Input
          type="text"
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-8 text-xs font-mono pr-8 bg-background hover:border-primary/50 transition-colors focus-visible:ring-1",
            !value && "text-muted-foreground",
            className
          )}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-1.5 p-1 rounded hover:bg-muted text-muted-foreground group-hover:text-primary transition-colors cursor-pointer"
            title="Open time picker"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="w-auto p-3 bg-popover border shadow-xl rounded-xl z-50 text-xs space-y-3" align="start">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            Pick Time
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetNow}
              className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-semibold"
            >
              Current Time
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Column Selectors */}
        <div className="flex items-center justify-center gap-2 py-1 bg-muted/20 p-2 rounded-lg border">
          {/* Hours Column */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-muted-foreground mb-1">Hour (24h)</span>
            <div className="h-40 w-14 overflow-y-auto border rounded-md bg-background p-1 space-y-1 scrollbar-thin">
              {hoursList.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setSelectedHour(h);
                    handleApply(h, selectedMinute, selectedSecond);
                  }}
                  className={cn(
                    "w-full py-1 text-center font-mono rounded text-xs transition-colors",
                    selectedHour === h
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <span className="text-sm font-bold text-muted-foreground pt-4">:</span>

          {/* Minutes Column */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-muted-foreground mb-1">Minute</span>
            <div className="h-40 w-14 overflow-y-auto border rounded-md bg-background p-1 space-y-1 scrollbar-thin">
              {minutesList.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMinute(m);
                    handleApply(selectedHour, m, selectedSecond);
                  }}
                  className={cn(
                    "w-full py-1 text-center font-mono rounded text-xs transition-colors",
                    selectedMinute === m
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {withSeconds && (
            <>
              <span className="text-sm font-bold text-muted-foreground pt-4">:</span>
              {/* Seconds Column */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-muted-foreground mb-1">Second</span>
                <div className="h-40 w-14 overflow-y-auto border rounded-md bg-background p-1 space-y-1 scrollbar-thin">
                  {secondsList.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSelectedSecond(s);
                        handleApply(selectedHour, selectedMinute, s);
                      }}
                      className={cn(
                        "w-full py-1 text-center font-mono rounded text-xs transition-colors",
                        selectedSecond === s
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-accent text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pt-1 border-t">
          <span className="text-[10px] font-medium text-muted-foreground block">Quick Time Presets</span>
          <div className="grid grid-cols-4 gap-1">
            {COMMON_PRESETS.slice(0, 8).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "px-1.5 py-1 text-[10px] font-mono rounded border hover:bg-primary/10 hover:text-primary transition-colors text-center",
                  value.startsWith(preset) ? "border-primary bg-primary/10 text-primary font-bold" : "bg-background"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Footer / Apply */}
        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-primary">
            Selected: {value || "--:--"}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 px-3 text-xs gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DurationPickerProps {
  value?: string; // e.g. "02:00" or "02:00:00"
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const DURATION_PRESETS = [
  { label: "30m", val: "00:30" },
  { label: "1h", val: "01:00" },
  { label: "1.5h", val: "01:30" },
  { label: "2h", val: "02:00" },
  { label: "3h", val: "03:00" },
  { label: "4h", val: "04:00" },
  { label: "6h", val: "06:00" },
  { label: "8h", val: "08:00" },
  { label: "12h", val: "12:00" },
  { label: "24h", val: "24:00" },
];

export function DurationPicker({
  value = "",
  onChange,
  placeholder = "00:00",
  className,
  disabled = false,
}: DurationPickerProps) {
  const [open, setOpen] = useState(false);

  const { hours, minutes } = useMemo(() => {
    if (!value) return { hours: "02", minutes: "00" };
    const parts = value.split(":").map((p) => p.trim());
    return {
      hours: parts[0] ? parts[0].padStart(2, "0") : "00",
      minutes: parts[1] ? parts[1].padStart(2, "0") : "00",
    };
  }, [value]);

  const [selectedHours, setSelectedHours] = useState(hours);
  const [selectedMinutes, setSelectedMinutes] = useState(minutes);

  useEffect(() => {
    setSelectedHours(hours);
    setSelectedMinutes(minutes);
  }, [hours, minutes, open]);

  const handleApply = (h: string, m: string) => {
    onChange(`${h.padStart(2, "0")}:${m.padStart(2, "0")}`);
  };

  const hoursList = useMemo(() => Array.from({ length: 49 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutesList = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative group flex items-center w-full">
        <Input
          type="text"
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-8 text-xs font-mono font-bold pr-8 bg-background hover:border-primary/50 transition-colors focus-visible:ring-1",
            !value && "text-muted-foreground",
            className
          )}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-1.5 p-1 rounded hover:bg-muted text-muted-foreground group-hover:text-primary transition-colors cursor-pointer"
            title="Open duration picker"
          >
            <Timer className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="w-auto p-3 bg-popover border shadow-xl rounded-xl z-50 text-xs space-y-3" align="start">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-primary" />
            Soaking Duration
          </span>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { onChange(""); setOpen(false); }}
              className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 py-1 bg-muted/20 p-2 rounded-lg border">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-muted-foreground mb-1">Hours</span>
            <div className="h-40 w-14 overflow-y-auto border rounded-md bg-background p-1 space-y-1 scrollbar-thin">
              {hoursList.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setSelectedHours(h);
                    handleApply(h, selectedMinutes);
                  }}
                  className={cn(
                    "w-full py-1 text-center font-mono rounded text-xs transition-colors",
                    selectedHours === h
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <span className="text-sm font-bold text-muted-foreground pt-4">:</span>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-muted-foreground mb-1">Minutes</span>
            <div className="h-40 w-14 overflow-y-auto border rounded-md bg-background p-1 space-y-1 scrollbar-thin">
              {minutesList.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMinutes(m);
                    handleApply(selectedHours, m);
                  }}
                  className={cn(
                    "w-full py-1 text-center font-mono rounded text-xs transition-colors",
                    selectedMinutes === m
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pt-1 border-t">
          <span className="text-[10px] font-medium text-muted-foreground block">Quick Durations</span>
          <div className="grid grid-cols-5 gap-1">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => { onChange(p.val); setOpen(false); }}
                className={cn(
                  "px-1 py-1 text-[10px] font-mono rounded border hover:bg-primary/10 hover:text-primary transition-colors text-center",
                  value === p.val ? "border-primary bg-primary/10 text-primary font-bold" : "bg-background"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-primary">
            Duration: {value || "00:00"}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 px-3 text-xs gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
