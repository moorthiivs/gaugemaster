import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DocumentationFilterComboboxProps {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  countMap?: Record<string, number>;
  className?: string;
}

export function DocumentationFilterCombobox({
  label,
  placeholder,
  searchPlaceholder,
  icon: Icon,
  options,
  value,
  onChange,
  countMap,
  className,
}: DocumentationFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, searchTerm]);

  const isSelected = Boolean(value && value !== "all");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 justify-between text-xs font-normal min-w-[170px] max-w-[220px] transition-all bg-background",
            isSelected
              ? "border-primary text-primary font-medium bg-primary/5 hover:bg-primary/10 hover:text-primary"
              : "text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {Icon && (
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              />
            )}
            <span className="truncate">
              {isSelected ? value : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-1.5 shrink-0">
            {isSelected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="rounded-full p-0.5 hover:bg-primary/20 text-primary cursor-pointer"
                title="Clear filter"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="start">
        {/* Search Input inside popover */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={searchPlaceholder || `Search ${label}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-muted/30 focus-visible:ring-1"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Options list */}
        <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs pr-1">
          {/* 'All' default item */}
          <button
            type="button"
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors",
              !isSelected
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-foreground"
            )}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <div className="flex items-center gap-2 truncate">
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  !isSelected ? "opacity-100 text-primary" : "opacity-0"
                )}
              />
              <span className="truncate">{placeholder}</span>
            </div>
          </button>

          {/* Filtered options */}
          {filteredOptions.map((opt) => {
            const active = value.toLowerCase() === opt.toLowerCase();
            const count = countMap ? countMap[opt] : undefined;
            return (
              <button
                key={opt}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
                onClick={() => {
                  onChange(active ? "" : opt);
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{opt}</span>
                </div>
                {count !== undefined && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 text-[10px] h-4 px-1.5 py-0 font-mono text-muted-foreground"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}

          {filteredOptions.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              <p>No matching {label.toLowerCase()}</p>
              {searchTerm.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 text-xs text-primary"
                  onClick={() => {
                    onChange(searchTerm.trim());
                    setOpen(false);
                  }}
                >
                  Filter by "{searchTerm.trim()}"
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
