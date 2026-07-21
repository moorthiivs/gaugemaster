import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ValidationRule {
  id?: string;
  fieldName: string;
  displayName: string;
  isRequired: boolean;
  isUnique?: boolean;
  isStrictDate?: boolean;
  validationType: string;
}

const DEFAULT_FIELDS = [
  { fieldName: "name", displayName: "Instrument Name", isRequired: true, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "id_code", displayName: "ID Code / IMTE", isRequired: true, isUnique: true, isStrictDate: false, validationType: "text" },
  { fieldName: "location", displayName: "Location", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "frequency", displayName: "Calibration Frequency", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "last_calibration_date", displayName: "Last Calibration Date", isRequired: true, isUnique: false, isStrictDate: true, validationType: "date" },
  { fieldName: "due_date", displayName: "Due Date", isRequired: true, isUnique: false, isStrictDate: true, validationType: "date" },
  { fieldName: "agency", displayName: "Calibration Agency", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "range", displayName: "Range", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "serial_no", displayName: "Serial No", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "least_count", displayName: "Least Count", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "make", displayName: "Make", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
  { fieldName: "remarks", displayName: "Remarks", isRequired: false, isUnique: false, isStrictDate: false, validationType: "text" },
];

export default function ValidationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [user.companyId]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get(`/validation/rules?companyId=${user.companyId}`);
      if (res.data.length === 0) {
        // Initialize with defaults if none exist
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Field Validation</h2>
          <p className="text-muted-foreground mt-1">Configure which fields are mandatory and how they appear in the system.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Card className="border-primary/10 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Validation Rules</CardTitle>
          </div>
          <CardDescription>
            These rules apply to both the <strong>Instrument Form</strong> and <strong>Excel Bulk Upload</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-muted">
            {rules.map((rule, index) => (
              <div key={rule.fieldName} className="flex items-center justify-between p-6 transition-colors hover:bg-muted/30">
                <div className="space-y-4 flex-1 max-w-md">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Field: {rule.fieldName}
                    </Label>
                    {rule.isRequired && <Badge variant="destructive" className="text-[10px] uppercase">Required</Badge>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`display-${index}`}>Display Name</Label>
                    <Input
                      id={`display-${index}`}
                      value={rule.displayName}
                      onChange={(e) => handleDisplayNameChange(index, e.target.value)}
                      placeholder="e.g. IMTE, ID Code..."
                      className="bg-background/50 focus:ring-primary/20"
                    />
                  </div>
                </div>

                  <div className="flex flex-col items-end gap-2 ml-8">
                    <div className="flex items-center space-x-3 bg-muted/40 p-3 rounded-xl border border-muted-foreground/10 w-full justify-between">
                      <Label htmlFor={`required-${index}`} className="font-semibold cursor-pointer">Required</Label>
                      <Switch
                        id={`required-${index}`}
                        checked={rule.isRequired}
                        onCheckedChange={() => handleToggleRequired(index)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    {rule.fieldName === 'id_code' && (
                      <div className="flex items-center space-x-3 bg-muted/40 p-3 rounded-xl border border-muted-foreground/10 w-full justify-between">
                        <Label htmlFor={`unique-${index}`} className="font-semibold cursor-pointer">Unique</Label>
                        <Switch
                          id={`unique-${index}`}
                          checked={rule.isUnique}
                          onCheckedChange={() => handleToggleUnique(index)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    )}
                    {rule.fieldName === 'due_date' && (
                      <div className="flex items-center space-x-3 bg-muted/40 p-3 rounded-xl border border-muted-foreground/10 w-full justify-between">
                        <div className="flex flex-col">
                          <Label htmlFor={`strict-date-${index}`} className="font-semibold cursor-pointer">Strict Sequence</Label>
                          <span className="text-[10px] text-muted-foreground">Must be after Last Calibration Date</span>
                        </div>
                        <Switch
                          id={`strict-date-${index}`}
                          checked={rule.isStrictDate !== false}
                          onCheckedChange={() => handleToggleStrictDate(index)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
