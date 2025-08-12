import { useEffect, useMemo, useState } from "react";
import { listInstruments, Instrument, InstrumentQuery, updateInstrument } from "@/lib/api";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apis";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";


const pageSize = 10;

export default function Instruments() {
  useSEO({ title: "Instruments — Calibration Alerts", description: "Browse, filter, and manage instruments." });
  const { toast } = useToast();
  const { user } = useAuth()
  const navigate = useNavigate();
  const [filters, setFilters] = useState<InstrumentQuery>({ status: "All", location: "All", frequency: "All", page: 1, pageSize });
  const [data, setData] = useState<{ items: Instrument[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.status && filters.status !== "All") queryParams.append("status", filters.status);
      if (filters.location && filters.location !== "All") queryParams.append("location", filters.location);
      if (filters.frequency && filters.frequency !== "All") queryParams.append("frequency", filters.frequency);
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.page) queryParams.append("page", String(filters.page));
      if (filters.pageSize) queryParams.append("pageSize", String(filters.pageSize));

      queryParams.append("createdBy", String(user.id));
      // API call
      const res = await api.get(`/instruments?${queryParams}`);
      if (!res.status) throw new Error("Failed to fetch instruments");
      const result = await res.data;
      setData({
        items: result.data,
        total: result.total
      });


      setSelected({});
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.page, filters.status, filters.location, filters.frequency]);

  const toggleAll = (checked: boolean) => {
    const map: Record<string, boolean> = {};
    for (const i of data.items) map[i.id] = checked;
    setSelected(map);
  };

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  const markCalibrated = async () => {
    const today = new Date();
    for (const id of selectedIds) {
      await updateInstrument(id, {
        last_calibration_date: today.toISOString(),
        due_date: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()).toISOString(),
      });
    }
    toast({ title: "Updated", description: `Marked ${selectedIds.length} as calibrated.` });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instruments</h1>
          <p className="text-muted-foreground">Filter and manage your inventory.</p>
        </div>
        <Button onClick={() => navigate("/instruments/new")}>Add instrument</Button>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        <Input placeholder="Search…" onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} className="md:col-span-2" />
        <Select value={filters.status as any} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any, page: 1 }))}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {(["All", "OK", "Overdue"] as const).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.frequency as any} onValueChange={(v) => setFilters((f) => ({ ...f, frequency: v as any, page: 1 }))}>
          <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
          <SelectContent>
            {(["All", "Yearly", "Half-Yearly", "Quarterly", "Monthly"] as const).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.location as any} onValueChange={(v) => setFilters((f) => ({ ...f, location: v as any, page: 1 }))}>
          <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            {(["All", "Lab A", "Lab B", "Field", "QA Room"] as const).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={!selectedIds.length} onClick={markCalibrated}>Mark calibrated</Button>
        <Button
          variant="outline"
          disabled={!data.items.length}
          onClick={() => {
            const header = ["name", "id_code", "location", "last_calibration_date", "due_date", "frequency", "agency", "status"];
            const csv = [header.join(","), ...data.items.map((r) => header.map((h) => (r as any)[h]).join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `instruments_page_${filters.page}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV (page)
        </Button>
      </div>

      <div className="rounded-md border">
        <Table aria-label="Instruments table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox onCheckedChange={(v) => toggleAll(!!v)} aria-label="Select all" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>ID Code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Last Calibration</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((i) => (
              <TableRow key={i.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/instruments/${i.id}/edit`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={!!selected[i.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [i.id]: !!v }))} aria-label={`Select ${i.name}`} />
                </TableCell>
                <TableCell>{i.name}</TableCell>
                <TableCell>{i.id_code}</TableCell>
                <TableCell>{i.location}</TableCell>
                <TableCell>{new Date(i.last_calibration_date).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(i.due_date).toLocaleDateString()}</TableCell>
                <TableCell>{i.frequency}</TableCell>
                <TableCell>{i.agency}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      i.status === "OK"
                        ? "success"
                        : i.status === "Overdue"
                          ? "destructive"
                          : "warning"
                    }
                    className="capitalize"
                  >
                    {i.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {filters.page} of {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={filters.page === 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}>Previous</Button>
          <Button variant="outline" disabled={filters.page === totalPages} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}>Next</Button>
        </div>
      </div>
    </div>
  );
}
