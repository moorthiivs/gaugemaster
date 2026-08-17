import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Trash2, MapPin, Mail, BellRing, Save, Search, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

interface LocationEmailMapping {
  id?: string;
  companyId: string;
  location: string;
  headName?: string;
  headEmail: string;
  managementEmails?: string[];
}

export default function LocationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<LocationEmailMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Threshold config
  const [dueThresholdDays, setDueThresholdDays] = useState<number>(15);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<LocationEmailMapping | null>(null);
  const [selectedLocationOption, setSelectedLocationOption] = useState<string>("");
  const [customLocationName, setCustomLocationName] = useState("");
  const [formHeadName, setFormHeadName] = useState("");
  const [formHeadEmail, setFormHeadEmail] = useState("");
  const [formManagementEmails, setFormManagementEmails] = useState("");

  const [existingLocations, setExistingLocations] = useState<string[]>([]);

  useEffect(() => {
    if (user?.companyId) {
      fetchLocations();
      fetchCompanySettings();
      fetchInstrumentLocations();
    }
  }, [user?.companyId]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get(`/settings/location-emails?companyId=${user.companyId}`);
      setLocations(res.data || []);
    } catch (err: any) {
      console.error("Failed to load location mappings", err);
      toast({ title: "Error", description: "Failed to load location email mappings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const res = await httpClient.get(`/settings?companyId=${user.companyId}&userId=${user.id}`);
      if (res.data?.dueReminderThresholdDays) {
        setDueThresholdDays(res.data.dueReminderThresholdDays);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInstrumentLocations = async () => {
    try {
      const res = await httpClient.get(`/instruments/filters/${user.id}`);
      if (res.data?.location) {
        setExistingLocations(res.data.location.filter((l: string) => l && l.trim() !== ""));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Compute mapped and unmapped locations
  const mappedLocationSet = useMemo(() => {
    return new Set(locations.map((l) => l.location.toLowerCase().trim()));
  }, [locations]);

  const unmappedExistingLocations = useMemo(() => {
    return existingLocations.filter((loc) => !mappedLocationSet.has(loc.toLowerCase().trim()));
  }, [existingLocations, mappedLocationSet]);

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase().trim();
    return locations.filter(
      (l) =>
        l.location.toLowerCase().includes(q) ||
        l.headEmail.toLowerCase().includes(q) ||
        (l.headName && l.headName.toLowerCase().includes(q))
    );
  }, [locations, searchQuery]);

  const handleOpenAdd = (prefillLocation?: string) => {
    setEditingMapping(null);
    if (prefillLocation) {
      setSelectedLocationOption(prefillLocation);
      setCustomLocationName("");
    } else if (unmappedExistingLocations.length > 0) {
      setSelectedLocationOption(unmappedExistingLocations[0]);
      setCustomLocationName("");
    } else {
      setSelectedLocationOption("__CUSTOM__");
      setCustomLocationName("");
    }
    setFormHeadName("");
    setFormHeadEmail("");
    setFormManagementEmails("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mapping: LocationEmailMapping) => {
    setEditingMapping(mapping);
    if (existingLocations.some((l) => l.toLowerCase().trim() === mapping.location.toLowerCase().trim())) {
      setSelectedLocationOption(mapping.location);
      setCustomLocationName("");
    } else {
      setSelectedLocationOption("__CUSTOM__");
      setCustomLocationName(mapping.location);
    }
    setFormHeadName(mapping.headName || "");
    setFormHeadEmail(mapping.headEmail || "");
    setFormManagementEmails((mapping.managementEmails || []).join(", "));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const finalLocation =
      selectedLocationOption === "__CUSTOM__" ? customLocationName.trim() : selectedLocationOption.trim();

    if (!finalLocation) {
      return toast({ title: "Validation Error", description: "Location name is required.", variant: "destructive" });
    }
    if (!formHeadEmail.trim()) {
      return toast({ title: "Validation Error", description: "Location Head Email is required.", variant: "destructive" });
    }

    const managementArr = formManagementEmails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    setSaving(true);
    try {
      await httpClient.post("/settings/location-emails", {
        id: editingMapping?.id,
        companyId: user.companyId,
        location: finalLocation,
        headName: formHeadName.trim(),
        headEmail: formHeadEmail.trim(),
        managementEmails: managementArr,
      });

      toast({
        title: "Success",
        description: editingMapping ? "Location mapping updated." : "New location mapping added.",
      });

      setIsModalOpen(false);
      fetchLocations();
      fetchInstrumentLocations();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.response?.data?.message || "Could not save location mapping.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location mapping?")) return;
    try {
      await httpClient.delete(`/settings/location-emails/${id}`);
      toast({ title: "Deleted", description: "Location mapping deleted." });
      fetchLocations();
      fetchInstrumentLocations();
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete location mapping.", variant: "destructive" });
    }
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await httpClient.post("/settings/mailconfig", {
        companyId: user.companyId,
        userId: user.id,
        dueReminderThresholdDays: Number(dueThresholdDays) || 15,
      });
      toast({ title: "Saved", description: "Due reminder threshold updated." });
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to save threshold.", variant: "destructive" });
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Location Heads & Email Routing</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Map company locations to Location Heads and Management to automate status-driven alerts and summary reports.
          </p>
        </div>
        <Button onClick={() => handleOpenAdd()} className="shadow-lg gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Location Head
        </Button>
      </div>

      {/* Unmapped Locations Alert Banner */}
      {unmappedExistingLocations.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {unmappedExistingLocations.length} Unmapped Location{unmappedExistingLocations.length > 1 ? "s" : ""} in Instrument Inventory
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                The following locations from your uploaded instruments do not have a designated Location Head:{" "}
                <span className="font-semibold">{unmappedExistingLocations.slice(0, 4).join(", ")}</span>
                {unmappedExistingLocations.length > 4 && ` and ${unmappedExistingLocations.length - 4} more`}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenAdd(unmappedExistingLocations[0])}
              className="bg-background text-xs font-semibold hover:bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Map {unmappedExistingLocations[0]}
            </Button>
          </div>
        </div>
      )}

      {/* Threshold Configuration Card */}
      <Card className="border-primary/10 shadow-md bg-card/60 backdrop-blur-sm rounded-xl">
        <CardHeader className="border-b bg-muted/20 py-4 px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">Due Reminder Threshold Window</CardTitle>
              <CardDescription className="text-xs">
                Advance window for daily notification emails sent to Location Heads before calibration due date.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="thresholdDays" className="whitespace-nowrap font-medium text-xs">
              Reminder Window:
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="thresholdDays"
                type="number"
                min="1"
                max="90"
                value={dueThresholdDays}
                onChange={(e) => setDueThresholdDays(Number(e.target.value))}
                className="w-20 font-bold text-center h-9 text-sm"
              />
              <span className="text-xs text-muted-foreground">Days before Due Date (Default: 15 Days)</span>
            </div>
          </div>
          <Button onClick={handleSaveThreshold} disabled={savingThreshold} variant="outline" size="sm" className="gap-2 shrink-0">
            {savingThreshold ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Threshold
          </Button>
        </CardContent>
      </Card>

      {/* Location Email Table */}
      <Card className="border-primary/10 shadow-lg overflow-hidden bg-card/60 backdrop-blur-sm rounded-xl">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-transparent p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold">Location Head & Management Email Directory</CardTitle>
                <CardDescription className="text-xs">
                  {locations.length} configured location mapping{locations.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
            </div>

            {/* Search Bar */}
            {locations.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter locations or emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground space-y-3">
              <MapPin className="h-10 w-10 mx-auto opacity-40 text-muted-foreground" />
              <p className="font-semibold text-base">No Location Email Mappings Yet</p>
              <p className="text-xs max-w-md mx-auto text-muted-foreground">
                Click <strong>"Add Location Head"</strong> above to select from your uploaded instrument locations or add a new plant location.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Location</TableHead>
                  <TableHead className="font-bold text-xs">Location Head</TableHead>
                  <TableHead className="font-bold text-xs">Head Email (Daily Reminders)</TableHead>
                  <TableHead className="font-bold text-xs">Management Emails (Summary Reports)</TableHead>
                  <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((loc) => (
                  <TableRow key={loc.id || loc.location} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary opacity-70" />
                        <span>{loc.location}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {loc.headName || <span className="text-muted-foreground italic text-xs">Not set</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 font-mono text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                        <Mail className="h-3 w-3" />
                        {loc.headEmail}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(loc.managementEmails || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {loc.managementEmails?.map((em, i) => (
                            <Badge key={i} variant="secondary" className="text-[11px] font-mono">
                              {em}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(loc)} className="h-7 w-7 text-primary hover:bg-primary/10">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => loc.id && handleDelete(loc.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editingMapping ? "Edit Location Mapping" : "Add Location Mapping"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an existing location from your instrument inventory or enter a new location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Smart Location Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Location *</Label>
              <Select
                value={selectedLocationOption}
                onValueChange={(val) => {
                  setSelectedLocationOption(val);
                  if (val !== "__CUSTOM__") {
                    setCustomLocationName("");
                  }
                }}
              >
                <SelectTrigger className="h-10 text-xs font-medium">
                  <SelectValue placeholder="Select Location from Inventory" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {/* Unmapped existing locations from instruments */}
                  {unmappedExistingLocations.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                        Available Instrument Locations ({unmappedExistingLocations.length})
                      </div>
                      {unmappedExistingLocations.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs font-medium">
                          📍 {loc}
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {/* Editing current location if not in unmapped */}
                  {editingMapping &&
                    !unmappedExistingLocations.includes(editingMapping.location) &&
                    editingMapping.location !== "__CUSTOM__" && (
                      <SelectItem value={editingMapping.location} className="text-xs font-medium">
                        📍 {editingMapping.location} (Current)
                      </SelectItem>
                    )}

                  {/* Already mapped locations (disabled/shown for reference) */}
                  {locations.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 mt-1">
                        Already Mapped Locations ({locations.length})
                      </div>
                      {locations.map((loc) => {
                        const isCurrent = editingMapping?.location.toLowerCase() === loc.location.toLowerCase();
                        if (isCurrent) return null;
                        return (
                          <SelectItem key={`mapped-${loc.location}`} value={loc.location} disabled className="text-xs opacity-50">
                            ✓ {loc.location} (Already Mapped)
                          </SelectItem>
                        );
                      })}
                    </>
                  )}

                  <div className="border-t my-1" />
                  <SelectItem value="__CUSTOM__" className="text-xs font-bold text-primary">
                    ➕ Enter Custom / New Location...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Location Text Input (shown when __CUSTOM__ is chosen) */}
            {selectedLocationOption === "__CUSTOM__" && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <Label htmlFor="customLoc" className="text-xs font-semibold text-primary">
                  Enter New Location Name *
                </Label>
                <Input
                  id="customLoc"
                  placeholder="e.g. Quality Lab 2, Machine Shop 3..."
                  value={customLocationName}
                  onChange={(e) => setCustomLocationName(e.target.value)}
                  className="h-10 text-xs"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="headName" className="text-xs font-semibold">
                Location Head Name (Optional)
              </Label>
              <Input
                id="headName"
                placeholder="e.g. John Doe"
                value={formHeadName}
                onChange={(e) => setFormHeadName(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="headEmail" className="text-xs font-semibold">
                Location Head Email *
              </Label>
              <Input
                id="headEmail"
                type="email"
                placeholder="head@company.com"
                value={formHeadEmail}
                onChange={(e) => setFormHeadEmail(e.target.value)}
                className="h-10 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Receives daily 15-day due alerts, overdue alerts, and calibrated collection notices for this location.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mgmtEmails" className="text-xs font-semibold">
                Management Summary Emails (Optional)
              </Label>
              <Input
                id="mgmtEmails"
                placeholder="manager1@company.com, manager2@company.com"
                value={formManagementEmails}
                onChange={(e) => setFormManagementEmails(e.target.value)}
                className="h-10 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated emails to receive periodic executive summary count reports for this location.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMapping ? "Update Mapping" : "Save Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
