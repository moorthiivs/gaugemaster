import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createInstrument, getInstrument, updateInstrument, Instrument } from "@/lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

const schema = z.object({
  name: z.string().min(2),
  id_code: z.string().min(2),
  range: z.string().optional(),
  serial_no: z.string().optional(),
  least_count: z.string().optional(),
  location: z.string().min(1),
  frequency: z.enum(["Yearly","Half-Yearly","Quarterly","Monthly"]),
  last_calibration_date: z.string(),
  due_date: z.string(),
  agency: z.string().min(1),
  status: z.enum(["OK","Overdue"]) ,
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function InstrumentForm() {
  const params = useParams();
  const isEdit = !!params.id;
  useSEO({ title: isEdit ? "Edit Instrument — Calibration Alerts" : "Add Instrument — Calibration Alerts" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      frequency: "Yearly",
      status: "OK",
      last_calibration_date: new Date().toISOString().slice(0,10),
      due_date: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().slice(0,10),
    }
  });

  useEffect(() => {
    if (isEdit) {
      getInstrument(params.id as string).then((i) => {
        if (i) {
          reset({
            name: i.name,
            id_code: i.id_code,
            range: "",
            serial_no: "",
            least_count: "",
            location: i.location,
            frequency: i.frequency,
            last_calibration_date: i.last_calibration_date.slice(0,10),
            due_date: i.due_date.slice(0,10),
            agency: i.agency,
            status: i.status,
            notes: "",
          });
        }
      });
    }
  }, [isEdit, params.id, reset]);

  const onSubmit = async (values: FormData) => {
    if (isEdit) {
      await updateInstrument(params.id as string, {
        ...values,
        last_calibration_date: new Date(values.last_calibration_date).toISOString(),
        due_date: new Date(values.due_date).toISOString(),
      } as Partial<Instrument>);
      toast({ title: "Updated", description: "Instrument updated." });
    } else {
      const payload = {
        name: values.name,
        id_code: values.id_code,
        location: values.location,
        frequency: values.frequency,
        last_calibration_date: new Date(values.last_calibration_date).toISOString(),
        due_date: new Date(values.due_date).toISOString(),
        agency: values.agency,
      } as const;
      await createInstrument(payload);
      toast({ title: "Created", description: "Instrument added." });
    }
    navigate("/instruments");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit instrument" : "Add instrument"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm">Name</label>
            <Input {...register("name")} aria-invalid={!!errors.name} />
          </div>
          <div>
            <label className="text-sm">ID Code</label>
            <Input {...register("id_code")} />
          </div>
          <div>
            <label className="text-sm">Location</label>
            <Input {...register("location")} />
          </div>
          <div>
            <label className="text-sm">Frequency</label>
            <select className="h-10 w-full rounded-md border bg-background px-3" {...register("frequency")}>
              {(["Yearly","Half-Yearly","Quarterly","Monthly"] as const).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm">Last calibration date</label>
            <Input type="date" {...register("last_calibration_date")} />
          </div>
          <div>
            <label className="text-sm">Due date</label>
            <Input type="date" {...register("due_date")} />
          </div>
          <div>
            <label className="text-sm">Agency</label>
            <Input {...register("agency")} />
          </div>
          <div>
            <label className="text-sm">Status</label>
            <select className="h-10 w-full rounded-md border bg-background px-3" {...register("status")}>
              {(["OK","Overdue"] as const).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Notes</label>
            <Input {...register("notes")} />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? "Save changes" : "Create"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
