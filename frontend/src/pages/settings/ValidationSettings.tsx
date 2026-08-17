import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Tag,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Filter,
  CheckCircle2,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ValidationRule {
  id?: string;
  fieldName: string;
  displayName: string;
  isRequired: boolean;
  isUnique?: boolean;
  isStrictDate?: boolean;
  validationType: string; // 'text', 'date', 'number'
  isCustom?: boolean;
  excelAliases?: string[];
}

const DEFAULT_FIELDS = [
  { fieldName: "name", displayName: "Instrument Name", isRequired: true, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "id_code", displayName: "ID Code / IMTE", isRequired: true, isUnique: true, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "location", displayName: "Location", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "frequency", displayName: "Calibration Frequency", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "last_calibration_date", displayName: "Last Calibration Date", isRequired: true, isUnique: false, isStrictDate: true, validationType: "date", isCustom: false },
  { fieldName: "due_date", displayName: "Due Date", isRequired: true, isUnique: false, isStrictDate: true, validationType: "date", isCustom: false },
  { fieldName: "agency", displayName: "Calibration Agency", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "range", displayName: "Range", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "serial_no", displayName: "Serial No", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "least_count", displayName: "Least Count", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "make", displayName: "Make", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
  { fieldName: "remarks", displayName: "Remarks", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text", isCustom: false },
];

export default function ValidationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View Mode: 'table' | 'cards'
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "standard" | "custom" | "required">("all");

  // Custom Column Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [customFieldName, setCustomFieldName] = useState("");
  const [customValidationType, setCustomValidationType] = useState("text");
  const [customIsRequired, setCustomIsRequired] = useState(false);
  const [customAliases, setCustomAliases] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [user.companyId]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get(`/validation/rules?companyId=${user.companyId}`);
      if (res.data.length === 0) {
        setRules(DEFAULT_FIELDS);
      } else {
        setRules(res.data);
      }
    } catch (err) {
      console.error("Error fetching rules:", err);
      toast({ title: "Error", description: "Failed to load validation rules", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequired = (index: number) => {
    const newRules = [...rules];
    newRules[index].isRequired = !newRules[index].isRequired;
    setRules(newRules);
  };

  const handleToggleUnique = (index: number) => {
    const newRules = [...rules];
    newRules[index].isUnique = !newRules[index].isUnique;
    setRules(newRules);
  };

  const handleToggleStrictDate = (index: number) => {
    const newRules = [...rules];
    newRules[index].isStrictDate = !newRules[index].isStrictDate;
    setRules(newRules);
  };

  const handleDisplayNameChange = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index].displayName = value;
    setRules(newRules);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await httpClient.post(`/validation/rules?companyId=${user.companyId}`, rules);
      setRules(res.data);
      toast({ title: "Success", description: "Validation rules updated successfully" });
    } catch (err) {
      console.error("Error saving rules:", err);
      toast({ title: "Error", description: "Failed to save validation rules", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisplayNameType = (val: string) => {
    setCustomDisplayName(val);
    if (!customFieldName || customFieldName.trim() === "" || customFieldName === customDisplayName.toLowerCase().replace(/[^a-z0-9]/g, "_")) {
      setCustomFieldName(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
    }
  };

  const handleAddCustomColumn = async () => {
    if (!customDisplayName.trim()) {
      return toast({ title: "Validation Error", description: "Display Name is required.", variant: "destructive" });
    }
    const finalKey = customFieldName.trim() || customDisplayName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");

    const aliasesArr = customAliases
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    setAddingCustom(true);
    try {
      await httpClient.post(`/validation/custom-field?companyId=${user.companyId}`, {
        fieldName: finalKey,
        displayName: customDisplayName.trim(),
        validationType: customValidationType,
        isRequired: customIsRequired,
        excelAliases: aliasesArr,
      });

      toast({ title: "Custom Column Added", description: `"${customDisplayName}" is now available in forms, bulk upload, and reports.` });
      setIsAddModalOpen(false);
      setCustomDisplayName("");
      setCustomFieldName("");
      setCustomValidationType("text");
      setCustomIsRequired(false);
      setCustomAliases("");
      fetchRules();
    } catch (err: any) {
      toast({
        title: "Failed to Add Column",
        description: err?.response?.data?.message || "Could not add custom field.",
        variant: "destructive",
      });
    } finally {
      setAddingCustom(false);
    }
  };

  const handleDeleteCustomField = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the custom column "${name}"?`)) return;
    try {
      await httpClient.delete(`/validation/custom-field/${id}`);
      toast({ title: "Column Deleted", description: `Custom column "${name}" was removed.` });
      fetchRules();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err?.response?.data?.message || "Could not delete custom field.",
        variant: "destructive",
      });
    }
  };

  // Filtered & Searched Rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Tab filter
      if (activeTab === "standard" && rule.isCustom) return false;
      if (activeTab === "custom" && !rule.isCustom) return false;
      if (activeTab === "required" && !rule.isRequired) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rule.displayName.toLowerCase().includes(q);
        const matchKey = rule.fieldName.toLowerCase().includes(q);
        const matchAliases = (rule.excelAliases || []).some((a) => a.toLowerCase().includes(q));
        if (!matchName && !matchKey && !matchAliases) return false;
      }

      return true;
    });
  }, [rules, activeTab, searchQuery]);

  const standardCount = useMemo(() => rules.filter((r) => !r.isCustom).length, [rules]);
  const customCount = useMemo(() => rules.filter((r) => r.isCustom).length, [rules]);
  const requiredCount = useMemo(() => rules.filter((r) => r.isRequired).length, [rules]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Field Validation & Custom Columns</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage mandatory requirements and custom columns across forms, bulk upload Excel templates, and reports.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button onClick={() => setIsAddModalOpen(true)} variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
            <Plus className="h-4 w-4 text-primary" /> Add Custom Column
          </Button>
          <Button onClick={handleSave} disabled={saving} size="default" className="shadow-lg gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Control Bar: Search + Filter Tabs + View Mode Toggle */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm rounded-xl">
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <Button
              size="sm"
              variant={activeTab === "all" ? "default" : "ghost"}
              onClick={() => setActiveTab("all")}
              className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            >
              All Columns ({rules.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "standard" ? "default" : "ghost"}
              onClick={() => setActiveTab("standard")}
              className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            >
              Standard ({standardCount})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "custom" ? "default" : "ghost"}
              onClick={() => setActiveTab("custom")}
              className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            >
              Custom ({customCount})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "required" ? "default" : "ghost"}
              onClick={() => setActiveTab("required")}
              className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            >
              Required ({requiredCount})
            </Button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search column name or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/40 shrink-0">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                className="h-7 w-7 rounded-md"
                title="Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("cards")}
                className="h-7 w-7 rounded-md"
                title="Card View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── TABLE VIEW ─── */}
      {viewMode === "table" && (
        <Card className="border-border/60 shadow-lg overflow-hidden bg-card/60 backdrop-blur-sm rounded-xl">
          <CardContent className="p-0">
            {filteredRules.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground space-y-2">
                <Search className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                <p className="font-semibold text-sm">No matching columns found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your search query or active filter tab.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-12 text-xs font-bold">#</TableHead>
                    <TableHead className="text-xs font-bold">Field Key</TableHead>
                    <TableHead className="text-xs font-bold min-w-[200px]">Display Label</TableHead>
                    <TableHead className="text-xs font-bold">Type</TableHead>
                    <TableHead className="text-xs font-bold">Category</TableHead>
                    <TableHead className="text-xs font-bold text-center">Required</TableHead>
                    <TableHead className="text-xs font-bold">Rules / Aliases</TableHead>
                    <TableHead className="text-right text-xs font-bold w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule, displayIndex) => {
                    const globalIndex = rules.findIndex((r) => r.fieldName === rule.fieldName);
                    return (
                      <TableRow key={rule.fieldName} className="hover:bg-muted/30 transition-colors">
                        {/* Index */}
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {displayIndex + 1}
                        </TableCell>

                        {/* Field Key */}
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[11px] bg-muted/30">
                            {rule.fieldName}
                          </Badge>
                        </TableCell>

                        {/* Display Label (Interactive Input) */}
                        <TableCell>
                          <Input
                            value={rule.displayName}
                            onChange={(e) => handleDisplayNameChange(globalIndex, e.target.value)}
                            className="h-8 text-xs font-medium bg-background max-w-sm"
                          />
                        </TableCell>

                        {/* Data Type */}
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                            {rule.validationType || "text"}
                          </Badge>
                        </TableCell>

                        {/* Category (Standard vs Custom) */}
                        <TableCell>
                          {rule.isCustom ? (
                            <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 text-[10px] font-bold">
                              Custom
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Standard
                            </Badge>
                          )}
                        </TableCell>

                        {/* Required Toggle */}
                        <TableCell className="text-center">
                          <Switch
                            checked={rule.isRequired}
                            onCheckedChange={() => handleToggleRequired(globalIndex)}
                            className="data-[state=checked]:bg-primary scale-90"
                          />
                        </TableCell>

                        {/* Special Rules / Aliases */}
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            {rule.fieldName === "id_code" && (
                              <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded border text-[11px]">
                                <span className="font-semibold text-muted-foreground">Unique:</span>
                                <Switch
                                  checked={rule.isUnique}
                                  onCheckedChange={() => handleToggleUnique(globalIndex)}
                                  className="data-[state=checked]:bg-primary scale-75"
                                />
                              </div>
                            )}

                            {rule.fieldName === "due_date" && (
                              <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded border text-[11px]">
                                <span className="font-semibold text-muted-foreground">Due &gt; Last Cal:</span>
                                <Switch
                                  checked={rule.isStrictDate !== false}
                                  onCheckedChange={() => handleToggleStrictDate(globalIndex)}
                                  className="data-[state=checked]:bg-primary scale-75"
                                />
                              </div>
                            )}

                            {rule.isCustom && (rule.excelAliases || []).length > 0 && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                Aliases: {rule.excelAliases?.join(", ")}
                              </span>
                            )}

                            {!rule.isCustom && rule.fieldName !== "id_code" && rule.fieldName !== "due_date" && (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          {rule.isCustom ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => rule.id && handleDeleteCustomField(rule.id, rule.displayName)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="Delete custom column"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 pr-2">System</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── CARD VIEW ─── */}
      {viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map((rule) => {
            const globalIndex = rules.findIndex((r) => r.fieldName === rule.fieldName);
            return (
              <Card key={rule.fieldName} className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm rounded-xl hover:shadow-md transition-all">
                <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {rule.isCustom ? (
                        <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 text-[10px] font-bold">
                          Custom
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Standard
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {rule.validationType || "text"}
                      </Badge>
                    </div>
                    {rule.isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => rule.id && handleDeleteCustomField(rule.id, rule.displayName)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 -mr-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground mt-1">key: {rule.fieldName}</p>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Display Label</Label>
                    <Input
                      value={rule.displayName}
                      onChange={(e) => handleDisplayNameChange(globalIndex, e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <Label className="text-xs font-semibold cursor-pointer">Required Field</Label>
                    <Switch
                      checked={rule.isRequired}
                      onCheckedChange={() => handleToggleRequired(globalIndex)}
                      className="data-[state=checked]:bg-primary scale-90"
                    />
                  </div>

                  {rule.fieldName === "id_code" && (
                    <div className="flex items-center justify-between pt-1 border-t">
                      <Label className="text-xs font-semibold cursor-pointer">Unique ID</Label>
                      <Switch
                        checked={rule.isUnique}
                        onCheckedChange={() => handleToggleUnique(globalIndex)}
                        className="data-[state=checked]:bg-primary scale-90"
                      />
                    </div>
                  )}

                  {rule.fieldName === "due_date" && (
                    <div className="flex items-center justify-between pt-1 border-t">
                      <Label className="text-xs font-semibold cursor-pointer">Strict Sequence (Due &gt; Last Cal)</Label>
                      <Switch
                        checked={rule.isStrictDate !== false}
                        onCheckedChange={() => handleToggleStrictDate(globalIndex)}
                        className="data-[state=checked]:bg-primary scale-90"
                      />
                    </div>
                  )}

                  {rule.isCustom && (rule.excelAliases || []).length > 0 && (
                    <div className="pt-2 border-t text-[11px] text-muted-foreground">
                      <span className="font-semibold">Excel Aliases:</span> {rule.excelAliases?.join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Custom Column Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" /> Add Custom Column
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a custom parameter that integrates seamlessly into Instrument forms, Bulk Upload, and Reports.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="customDisp" className="text-xs font-semibold">Column Label (Display Name) *</Label>
              <Input
                id="customDisp"
                placeholder="e.g. Vendor Code, Storage Rack, Tolerance"
                value={customDisplayName}
                onChange={(e) => handleDisplayNameType(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customKey" className="text-xs font-semibold">Internal Field Key</Label>
              <Input
                id="customKey"
                placeholder="e.g. vendor_code"
                value={customFieldName}
                onChange={(e) => setCustomFieldName(e.target.value)}
                className="font-mono text-xs h-10"
              />
              <p className="text-[11px] text-muted-foreground">Stored inside instrument custom parameters.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customType" className="text-xs font-semibold">Data Type</Label>
              <Select value={customValidationType} onValueChange={setCustomValidationType}>
                <SelectTrigger id="customType" className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (General string)</SelectItem>
                  <SelectItem value="number">Number (Numeric value)</SelectItem>
                  <SelectItem value="date">Date (Calendar date)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <Label htmlFor="customReq" className="font-semibold text-xs cursor-pointer">Mandatory Field</Label>
                <p className="text-[11px] text-muted-foreground">Require this field when adding or uploading instruments.</p>
              </div>
              <Switch
                id="customReq"
                checked={customIsRequired}
                onCheckedChange={setCustomIsRequired}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customAliases" className="text-xs font-semibold">Excel Column Aliases (Optional)</Label>
              <Input
                id="customAliases"
                placeholder="e.g. Vendor ID, VendorCode, VCode"
                value={customAliases}
                onChange={(e) => setCustomAliases(e.target.value)}
                className="h-10 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated alternative header names to match during Excel bulk upload.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} disabled={addingCustom}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCustomColumn} disabled={addingCustom} className="gap-2">
              {addingCustom && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
