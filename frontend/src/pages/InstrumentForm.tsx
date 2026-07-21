import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { Instrument } from "@/types/instrument";
import DynamicForm, { FormFieldConfig } from "@/components/DynamicForm";

const computeStatusOptions = (currentStatus: string, dueDate: string) => {
  const today = new Date();
  const due = new Date(dueDate);

  // 1. Overdue condition
  if (due < today) {
    return ["Overdue"];
  }

  // 2. Upcoming Calibration condition
  if (currentStatus === "Upcoming Calibration (10 days before )") {
    return ["Upcoming Calibration (10 days before )", "Sent for Calibration"];
  }

  // 3. Sent for Calibration condition
  if (currentStatus === "Sent for Calibration") {
    return ["Sent for Calibration", "Overdue"];
  }

  // 4. Default: OK
  return [
    "OK",
    "Upcoming Calibration (10 days before )",
    "Sent for Calibration",
    "Overdue"
  ];
};

const INSTRUMENT_FIELDS: FormFieldConfig[] = [
  { name: "name", label: "Instrument Name", type: "text", col: 6 },
  { name: "id_code", label: "ID Code / IMTE", type: "text", col: 6 },
  { name: "range", label: "Range", type: "text", col: 4 },
  { name: "serial_no", label: "Serial No.", type: "text", col: 4 },
  { name: "least_count", label: "Least Count", type: "text", col: 4 },
  { name: "location", label: "Location", type: "text", col: 4 },
  { name: "agency", label: "Agency & TC No", type: "text", col: 4 },
  { name: "is_reference_standard", label: "Is Reference Standard / Master Instrument?", type: "checkbox", col: 12 },
  { name: "make", label: "Item Make", type: "text", col: 4 },
  { name: "item_type", label: "Item Type", type: "text", col: 4 },
  { name: "part_no", label: "Part No", type: "text", col: 4 },
  { name: "part_name", label: "Part Name", type: "text", col: 4 },
  { name: "module", label: "Module/Plant", type: "text", col: 4 },
  { name: "calibration_source", label: "Calibration Source", type: "text", col: 4 },
  { name: "customer", label: "Customer", type: "text", col: 4 },
  { name: "sector", label: "Sector", type: "text", col: 4 },
  { name: "criticality_level", label: "Criticality Level", type: "text", col: 4 },
  { name: "cert_no", label: "Cert. No.", type: "text", col: 4 },
  { name: "traceable", label: "Traceable", type: "text", col: 4 },
  { name: "gauges_received_by", label: "Gauges Received By", type: "text", col: 4 },
  { name: "gauges_issued_by", label: "Gauges Issued By", type: "text", col: 4 },
  { name: "calibration_procedure", label: "Calibration Procedure", type: "textarea", col: 12 },
  { name: "remarks", label: "Remarks", type: "textarea", col: 12 },
  { name: "notes", label: "Notes", type: "textarea", col: 12 },
  { name: "last_calibration_date", label: "Last Calibration Date", type: "date", col: 4, defaultValue: new Date().toISOString().slice(0, 10) },
  { name: "due_date", label: "Due Date", type: "date", col: 4, defaultValue: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().slice(0, 10) },
  { name: "gauge_issue_date", label: "Gauge Issue Date", type: "date", col: 4 },
  {
    name: "frequency",
    label: "Frequency",
    type: "select",
    col: 6,
    options: ["1 MONTH", "2 MONTH", "3 MONTH", "6 MONTH", "12 MONTH", "24 MONTH", "36 MONTH", "48 MONTH", "60 MONTH"]
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    col: 6,
    options: (watchedValues: any) => {
      return computeStatusOptions(watchedValues.status || "OK", watchedValues.due_date || new Date().toISOString());
    }
  },
  {
    name: "item_status",
    label: "Item Status",
    type: "select",
    col: 6,
    options: ["Active", "Inactive", "Scrapped", "Lost", "Under Repair"]
  }
];

export default function InstrumentForm() {
  const { user } = useAuth();
  const params = useParams();
  const isEdit = !!params.id;
  useSEO({ title: isEdit ? "Edit Instrument — Calibration Alerts" : "Add Instrument — Calibration Alerts" });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isSaving, setIsSaving] = useState(false);
  const [validationRules, setValidationRules] = useState<any[]>([]);
  const [instrumentData, setInstrumentData] = useState<any>(null);

  // 1. Fetch dynamic validation rules
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await httpClient.get(`/validation/rules?companyId=${user.companyId}`);
        setValidationRules(res.data);
      } catch (err) {
        console.error("Failed to fetch rules", err);
      }
    };
    fetchRules();
  }, [user.companyId]);

  // 2. Fetch instrument details if in Edit Mode
  useEffect(() => {
    const fetchInstrument = async () => {
      try {
        const response = await httpClient.get(`/instruments/${params.id}`);
        const i = response.data;

        setInstrumentData({
          name: i.name || "",
          id_code: i.id_code || "",
          range: i.range ?? "",
          serial_no: i.serial_no ?? "",
          least_count: i.least_count ?? "",
          location: i.location || "",
          frequency: i.frequency || "12 MONTH",
          last_calibration_date: i.last_calibration_date ? i.last_calibration_date.slice(0, 10) : "",
          due_date: i.due_date ? i.due_date.slice(0, 10) : "",
          agency: i.agency ?? "",
          status: i.status || "OK",
          item_status: i.item_status || "Active",
          notes: i.notes ?? "",
          make: i.make ?? "",
          item_type: i.item_type ?? "",
          part_no: i.part_no ?? "",
          part_name: i.part_name ?? "",
          module: i.module ?? "",
          calibration_source: i.calibration_source ?? "",
          customer: i.customer ?? "",
          sector: i.sector ?? "",
          criticality_level: i.criticality_level ?? "",
          cert_no: i.cert_no ?? "",
          remarks: i.remarks ?? "",
          gauge_issue_date: i.gauge_issue_date ? i.gauge_issue_date.slice(0, 10) : "",
          gauges_received_by: i.gauges_received_by ?? "",
          gauges_issued_by: i.gauges_issued_by ?? "",
          calibration_procedure: i.calibration_procedure ?? "",
          traceable: i.traceable ?? "",
          is_reference_standard: i.is_reference_standard || false,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load instrument details.",
          variant: "destructive",
        });
      }
    };

    if (params.id) {
      fetchInstrument();
    } else {
      // Set default values for New Instrument Mode
      setInstrumentData({
        frequency: "12 MONTH",
        status: "OK",
        item_status: "Active",
        last_calibration_date: "",
        due_date: "",
        is_reference_standard: false,
      });
    }
  }, [params.id]);

  // 3. Handle Form Submit
  const onSubmit = async (values: any) => {
    const dueRule = validationRules.find(r => r.fieldName === 'due_date');
    const isStrictDate = dueRule ? dueRule.isStrictDate !== false : true;

    if (isStrictDate && values.due_date && values.last_calibration_date) {
      if (new Date(values.due_date) <= new Date(values.last_calibration_date)) {
        toast({
          title: "Validation Error",
          description: "Due Date must be after Last Calibration Date",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Omit<Instrument, "id"> = {
        name: values.name,
        id_code: values.id_code,
        location: values.location || "",
        frequency: values.frequency,
        agency: values.agency || "",
        last_calibration_date: values.last_calibration_date ? new Date(values.last_calibration_date).toISOString() : null,
        due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
        range: values.range || "",
        serial_no: values.serial_no || "",
        least_count: values.least_count || "",
        notes: values.notes || "",
        status: values.status || "OK",
        item_status: values.item_status || "Active",
        make: values.make || "",
        item_type: values.item_type || "",
        part_no: values.part_no || "",
        part_name: values.part_name || "",
        module: values.module || "",
        calibration_source: values.calibration_source || "",
        customer: values.customer || "",
        sector: values.sector || "",
        criticality_level: values.criticality_level || "",
        cert_no: values.cert_no || "",
        remarks: values.remarks || "",
        gauge_issue_date: values.gauge_issue_date ? new Date(values.gauge_issue_date).toISOString() : null,
        gauges_received_by: values.gauges_received_by || "",
        gauges_issued_by: values.gauges_issued_by || "",
        calibration_procedure: values.calibration_procedure || "",
        traceable: values.traceable || "",
        created_by: user.id,
        updated_by: user.id,
        companyId: user.companyId,
        is_reference_standard: values.is_reference_standard || false,
      };

      if (isEdit) {
        await httpClient.patch(`/instruments/${params.id}`, payload);
        toast({ title: "Updated", description: "Instrument updated successfully." });
      } else {
        await httpClient.post("/instruments", payload);
        toast({ title: "Created", description: "Instrument added successfully." });
      }

      navigate("/instruments");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "An unexpected error occurred.";

      toast({
        title: "Error",
        description: Array.isArray(message) ? message.join(", ") : String(message),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Handle Side Effects when fields change (e.g. Due Date side-effects)
  const onChangeEffects = (
    name: string,
    value: any,
    setValue: any,
    getValues: any
  ) => {
    if (name === "due_date") {
      const today = new Date();
      const due = new Date(value);
      if (due < today) {
        setValue("status", "Overdue");
      }
    }
  };

  const isFormLoading = !instrumentData || validationRules.length === 0;

  return (
    <Card className="border-primary/10 shadow-2xl bg-card/50 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="flex items-center gap-2 p-6 border-b bg-gradient-to-r from-primary/5 to-transparent">
        {isEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/instruments")}
            className="rounded-full hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <CardTitle className="text-2xl font-bold">
            {isEdit ? "Edit Instrument" : "Add New Instrument"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the fields below to track your calibration data.
          </p>
        </div>
      </div>
      <CardContent className="p-8">
        {isFormLoading ? (
          <div className="grid gap-6 md:grid-cols-12 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="md:col-span-4 space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <DynamicForm
            fields={INSTRUMENT_FIELDS}
            validationRules={validationRules}
            defaultValues={instrumentData}
            onSubmit={onSubmit}
            onCancel={() => navigate("/instruments")}
            isSubmitting={isSaving}
            onChangeEffects={onChangeEffects}
          />
        )}
      </CardContent>
    </Card>
  );
}