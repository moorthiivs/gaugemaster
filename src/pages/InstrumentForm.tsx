import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/apis";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2),
  id_code: z.string().min(2),
  range: z.string().optional(),
  serial_no: z.string().optional(),
  least_count: z.string().optional(),
  location: z.string().min(1),
  frequency: z.enum(["Yearly", "Half-Yearly", "Quarterly", "Monthly"]),
  last_calibration_date: z.string(),
  due_date: z.string(),
  agency: z.string().min(1),
  status: z.enum(["OK", "Overdue"]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;


export type Instrument = {
  id: string;
  name: string;
  id_code: string;
  location: string;
  last_calibration_date: string; // ISO
  due_date: string; // ISO
  frequency: "Yearly" | "Half-Yearly" | "Quarterly" | "Monthly";
  agency: string;
  status: "OK" | "Overdue";
  range?: string;
  serial_no?: string;
  least_count?: string;
  notes?: string;
  updated_by?: string
  created_by?: string
};

export default function InstrumentForm() {

  const { user } = useAuth()
  const params = useParams();
  const isEdit = !!params.id;
  useSEO({ title: isEdit ? "Edit Instrument — Calibration Alerts" : "Add Instrument — Calibration Alerts" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      frequency: "Yearly",
      status: "OK",
      last_calibration_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().slice(0, 10),
    }
  });

  useEffect(() => {
    const fetchInstrument = async () => {
      try {
        const response = await api.get(`/instruments/${params.id}`);
        const i = response.data;

        reset({
          name: i.name,
          id_code: i.id_code,
          range: i.range ?? "",
          serial_no: i.serial_no ?? "",
          least_count: i.least_count ?? "",
          location: i.location,
          frequency: i.frequency,
          last_calibration_date: i.last_calibration_date.slice(0, 10),
          due_date: i.due_date.slice(0, 10),
          agency: i.agency,
          status: i.status,
          notes: i.notes ?? "",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load instrument details.",
          variant: "destructive",
        });
      }
    };

    if (params.id) fetchInstrument();
  }, [params.id, reset]);



  const onSubmit = async (values: FormData) => {
    try {
      const payload: Omit<Instrument, "id"> = {
        name: values.name!,
        id_code: values.id_code!,
        location: values.location!,
        frequency: values.frequency!,
        agency: values.agency!,
        last_calibration_date: new Date(values.last_calibration_date).toISOString(),
        due_date: new Date(values.due_date).toISOString(),
        range: values.range,
        serial_no: values.serial_no,
        least_count: values.least_count,
        notes: values.notes,
        status: values.status,
        created_by: user.id,
        updated_by: user.id
      };

      let response;
      if (isEdit) {
        response = await api.patch(`/instruments/${params.id as string}`, payload)
        toast({ title: "Updated", description: "Instrument updated successfully." });
      } else {
        response = await api.post("/instruments", payload);
        toast({ title: "Created", description: "Instrument added successfully." });
      }

      console.log(response, "response");
      navigate("/instruments");

    } catch (error: any) {
      // If backend sends structured error message
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "An unexpected error occurred.";

      toast({
        title: "Error",
        description: Array.isArray(message) ? message.join(", ") : String(message),
        variant: "destructive",
      });
    }
  };



  return (
    <Card>
      <div className="flex items-center gap-2 my-3 mx-3">
        {isEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/instruments")}
            className="p-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <CardTitle className="text-lg font-semibold">
          {isEdit ? "Edit instrument" : "Add instrument"}
        </CardTitle>
      </div>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          {[
            { label: "Name", name: "name" },
            { label: "ID Code", name: "id_code" },
            { label: "Range", name: "range" },
            { label: "Serial No.", name: "serial_no" },
            { label: "Least Count", name: "least_count" },
            { label: "Location", name: "location" },
            { label: "Agency & TC No", name: "agency" },
            { label: "Notes", name: "notes", full: true },
          ].map(({ label, name, full }) => (
            <div key={name} className={full ? "md:col-span-2" : undefined}>
              <label className="text-sm">{label}</label>
              <Input type={"text"} {...register(name as keyof FormData)} />
            </div>
          ))}


          <div>
            <label className="text-sm">Last Calibration Date</label>
            <Controller
              control={control}
              name="last_calibration_date"
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!dateValue ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateValue ? format(dateValue, "yyyy-MM-dd") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={(date) => {
                          if (date) {
                            const localDate = format(date, "yyyy-MM-dd");
                            field.onChange(localDate);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
          </div>

          <div>
            <label className="text-sm">Due Date</label>
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!dateValue ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateValue ? format(dateValue, "yyyy-MM-dd") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={(date) => {
                          if (date) {
                            const localDate = format(date, "yyyy-MM-dd");
                            field.onChange(localDate);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
          </div>


          <div>
            <label className="text-sm">Frequency</label>
            <Controller
              control={control}
              name="frequency"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-10 w-full rounded-md border bg-background px-3">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Yearly", "Half-Yearly", "Quarterly", "Monthly"] as const).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <label className="text-sm">Status</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-10 w-full rounded-md border bg-background px-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["OK", "Overdue"] as const).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}