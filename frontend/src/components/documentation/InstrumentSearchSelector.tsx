import { useState, useEffect, useRef } from "react";
import { Search, Compass, Check, X, RefreshCw, Layers, Hash, Cog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listInstruments } from "@/lib/instrumentActions";
import { Instrument } from "@/types/instrument";
import { toast } from "sonner";

interface InstrumentSearchSelectorProps {
  label?: string;
  required?: boolean;
  companyId?: string;
  defaultDeviceType?: string;
  selectedInstrumentId?: string;
  selectedName?: string;
  selectedIdCode?: string;
  selectedPartName?: string;
  onSelect: (instrument: Instrument) => void;
  onClear?: () => void;
}

export function InstrumentSearchSelector({
  label = "Select Gauge / Instrument",
  required = true,
  companyId,
  defaultDeviceType = "gauge",
  selectedInstrumentId,
  selectedName,
  selectedIdCode,
  selectedPartName,
  onSelect,
  onClear,
}: InstrumentSearchSelectorProps) {
  const [deviceType, setDeviceType] = useState<string>(defaultDeviceType);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 250ms for instant responsive typing across 2,000+ items
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch instruments whenever debounced term, deviceType, or companyId changes
  useEffect(() => {
    let isCancelled = false;

    const fetchGauges = async () => {
      setIsLoading(true);
      try {
        const queryParams: any = {
          pageSize: 50,
          page: 1,
          search: debouncedTerm.trim() || undefined,
          companyId: companyId || undefined,
        };

        if (deviceType && deviceType !== "All") {
          queryParams.device_type = deviceType;
        }

        const res = await listInstruments(queryParams);
        if (!isCancelled) {
          const list = Array.isArray(res) ? res : res?.data || [];
          setInstruments(list);
          setTotalCount(res?.total || list.length);
        }
      } catch (err: any) {
        if (!isCancelled) {
          toast.error("Failed to search instruments master");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchGauges();

    return () => {
      isCancelled = true;
    };
  }, [debouncedTerm, deviceType, companyId]);

  // Handle outside click to close dropdown list
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasSelection = Boolean(selectedName || selectedIdCode || selectedInstrumentId);

  const handleSelectItem = (inst: Instrument) => {
    onSelect(inst);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {totalCount > 0 && !hasSelection && (
          <span className="text-[11px] text-muted-foreground font-mono">
            {totalCount.toLocaleString()} available
          </span>
        )}
      </div>

      {/* When an instrument has been selected, show a clear & informative preview card */}
      {hasSelection ? (
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
          <div className="space-y-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
                <Compass className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold text-foreground truncate" title={selectedName}>
                {selectedName || "Unnamed Gauge"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {selectedIdCode && (
                <Badge variant="outline" className="text-[11px] font-mono font-medium gap-1 bg-background text-foreground">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span>ID / IMTE: {selectedIdCode}</span>
                </Badge>
              )}
              {selectedPartName && (
                <Badge variant="secondary" className="text-[11px] font-medium gap-1">
                  <Cog className="h-3 w-3 text-muted-foreground" />
                  <span>Part: {selectedPartName}</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium border-primary/20 hover:border-primary/40 hover:bg-background"
              onClick={() => setIsOpen(true)}
            >
              Change
            </Button>
            {onClear && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onClear}
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Search and Selection Interface */}
      {(!hasSelection || isOpen) && (
        <div className="space-y-2 relative">
          {/* On-screen controls: Device Type filter + Search bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {/* Device Type Filter */}
            <div className="sm:w-44 shrink-0">
              <Select value={deviceType} onValueChange={(val) => setDeviceType(val)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <div className="flex items-center gap-1.5 truncate">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Device Type" />
                  </div>
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="gauge">Gauges</SelectItem>
                  <SelectItem value="instrument">Instruments</SelectItem>
                  <SelectItem value="reference standard">Reference Standards</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="All">All Types</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fast debounced search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search 2,000+ items by name, ID code / IMTE, or part..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="pl-9 pr-9 h-9 text-xs bg-background"
              />
              {isLoading && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
              )}
            </div>
          </div>

          {/* Results Dropdown Menu */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-lg shadow-lg max-h-64 overflow-y-auto divide-y">
              {isLoading && instruments.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Searching instruments master...</span>
                </div>
              ) : instruments.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <p className="font-medium">No matching items found</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Try adjusting the search query or switch device type filter.
                  </p>
                </div>
              ) : (
                instruments.map((inst) => {
                  const isCurrent =
                    inst.id === selectedInstrumentId ||
                    (inst.id_code && inst.id_code === selectedIdCode);

                  return (
                    <div
                      key={inst.id}
                      onClick={() => handleSelectItem(inst)}
                      className={`p-2.5 px-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                        isCurrent ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {inst.name || "Unnamed Item"}
                          </span>
                          {inst.device_type && (
                            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-mono">
                              &bull; {inst.device_type}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {inst.id_code ? (
                            <span className="font-mono px-1.5 py-0.5 bg-muted rounded text-[10px] font-semibold text-foreground">
                              ID: {inst.id_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">No ID</span>
                          )}

                          {inst.part_name && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium truncate max-w-[150px]">
                              Part: {inst.part_name}
                            </span>
                          )}

                          {inst.location && (
                            <span className="text-muted-foreground text-[10px] truncate max-w-[120px]">
                              Loc: {inst.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCurrent ? (
                          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-medium px-2 hover:bg-primary hover:text-primary-foreground"
                          >
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
