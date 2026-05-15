import { useEffect, useMemo, useState } from "react";
import { Instrument, InstrumentQuery, updateInstrument } from "@/lib/api";
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
import ExcelUpload from "@/components/ExcelUpload";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { PlusCircle, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TooltipProv from "@/components/TooltipProv";
import { Label } from "@radix-ui/react-label";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { Textarea } from "@/components/ui/textarea";


const pageSize = 10;

export default function Instruments() {
  useSEO({ title: "Instruments — Calibration Alerts", description: "Browse, filter, and manage instruments." });
  const { toast } = useToast();
  const { user } = useAuth()
  const navigate = useNavigate();
  const [filters, setFilters] = useState<InstrumentQuery>({ status: "All", location: "All", frequency: "All", page: 1, pageSize, limit: 10 });
  const [data, setData] = useState<{ items: Instrument[]; total: number }>({ items: [], total: 0 });
  const [allData, setAllData] = useState<Instrument[]>([]); // store original data
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [StatusFillter, setStatusFilter] = useState([])

  const [FrequencyFillter, setFrequencyFilter] = useState([])

  const [LocationFillter, setLocationFilter] = useState([])

  const [isOpenupload, setisOpenupload] = useState(false);
  const [rejectedFile, setRejectedFile] = useState<Blob | null>(null);




  const [isOpenCalibagency, setisOpenCalibagency] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState("");
  const [description, setDescription] = useState("");

  const [isSendCalibration, setisSendCalibration] = useState(false);

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
      setAllData(result.data); // keep original copy
      setSelected({});
    } catch (error) {
      toast({ title: 'error', description: String(error), variant: 'destructive' })
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.page, filters.status, filters.location, filters.frequency]);

  useEffect(() => {
    api.get(`/instruments/filters/${user.id}`).then(res => {
      setStatusFilter(["All", ...res.data.status]);
      setFrequencyFilter(["All", ...res.data.frequency]);
      setLocationFilter(["All", ...res.data.location]);
    });
  }, []);


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
    fetchData();
  };



  const handleSendMail = async () => {
    setisSendCalibration(true)
    try {
      const selectedItems = data.items.filter((i) => selected[i.id]);
      const payload = {
        to: selectedAgency,
        description,
        instruments: selectedItems,
        userId: user.id,
      };

      console.log(payload, "payload");
      const res = await api.post(`/instruments/send-calibration-agency`, payload);
      console.log("Mail Payload:", res);
      setisOpenCalibagency(false);

      toast({
        title: "Mail Sent Successfully",
        description: "Calibration request has been sent to the selected agency.",
        variant: 'success',
      });
      setisSendCalibration(false)
    } catch (error) {
      console.log(error);
      toast({
        title: "Sending Failed",
        description: "Unable to send calibration mail. Please try again.",
        variant: "destructive",
      });
    } finally {
      setisSendCalibration(false)
    }

  };

  return (
    <>
      <div className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Instruments</h1>
            <p className="text-muted-foreground">Filter and manage your inventory.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:w-auto" onClick={() => navigate("/instruments/new")}>
              <PlusCircle className="h-4 w-4 mr-2" /> Add instrument
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setisOpenupload(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload instrument
            </Button>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Search… by 	Name or IDcode" onChange={(e) => {
            const searchValue = e.target.value.toLowerCase();

            if (!searchValue) {
              // If empty, reset back to original
              setData({ items: allData, total: allData.length });
              return;
            }

            const filterData = allData.filter((value: any) => {
              const nameMatch = value.name?.toLowerCase().includes(searchValue);
              const idCodeMatch = value.id_code?.toLowerCase().includes(searchValue);
              return nameMatch || idCodeMatch;
              //value.name.toLowerCase().includes(searchValue)
            });

            setData({ items: filterData, total: filterData.length });
          }}
            className="md:col-span-2" />
          <TooltipProv content="Filter instruments by status">
            <Select
              value={filters.status as any}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any, page: 1 }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>

                {StatusFillter.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TooltipProv>

          <TooltipProv content="Filter instruments by Frequency">
            <Select value={filters.frequency as any} onValueChange={(v) => setFilters((f) => ({ ...f, frequency: v as any, page: 1 }))}>
              <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
              <SelectContent>
                {FrequencyFillter.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TooltipProv>

          <TooltipProv content="Filter instruments by Location">
            <Select value={filters.location as any} onValueChange={(v) => setFilters((f) => ({ ...f, location: v as any, page: 1 }))}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                {LocationFillter.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </TooltipProv>
        </div>

        <div className="flex items-center gap-2">
          {/* <Button variant="secondary" disabled={!selectedIds.length} onClick={markCalibrated}>Mark calibrated</Button> */}
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
          <Button variant="secondary" disabled={!selectedIds.length} onClick={() => setisOpenCalibagency(true)}>Send For Agency</Button>
        </div>


        <div className="rounded-md border overflow-x-auto">
          <Table aria-label="Instruments table" className="min-w-[10px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox onCheckedChange={(v) => toggleAll(!!v)} aria-label="Select all" />
                </TableHead>
                <TableHead>S.No</TableHead>
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
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  </TableRow>
                ))
                : data.items.map((i, index) => (
                  <TableRow
                    key={i.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/instruments/${i.id}/edit`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!selected[i.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [i.id]: !!v }))}
                        aria-label={`Select ${i.name}`}
                      />
                    </TableCell>
                    {/* <TableCell>{i.sino}</TableCell> */}
                    <TableCell>{i.sino ? i.sino : (filters.page - 1) * filters.limit + index + 1}</TableCell>

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
                              : i.status === "Sent for Calibration"
                                ? "premium"
                                : "warning" // Upcoming Calibration (10 days before)
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

      <Dialog open={isOpenupload} onOpenChange={setisOpenupload}>
        <DialogContent className="max-w-lg">
          <ExcelUpload
            endpoint="/instruments/bulk-upload"
            mapRow={(row) => ({
              sino: row["S.No"],
              name: row["NAME OF INSTRUMENT"],
              id_code: row["ID CODE"],
              range: row["RANGE"],
              serial_no: row["SERIAL NO"],
              least_count: row["LEAST COUNT"],
              location: row["LOCATION"],
              frequency: row["CALIBRATION FREQUENCY"],
              last_calibration_date: row["LAST CALIBRATION DATE"]
                ? new Date(row["LAST CALIBRATION DATE"]).toISOString()
                : null,
              due_date: row["DUE DATE"] ? new Date(row["DUE DATE"]).toISOString() : null,
              agency: row["CALIBRATION AGENCY AND TC No"],
              status: row["STATUS"],
              custom_parameters: {},
            })}

            rejectedFile={rejectedFile}
            setRejectedFile={setRejectedFile}
            onComplete={() => {
              fetchData();
              setisOpenupload(false);
            }}


          />
        </DialogContent>
      </Dialog>



      <Dialog open={isOpenCalibagency} onOpenChange={setisOpenCalibagency}>
        <DialogContent className="max-w-lg space-y-4">

          <DialogHeader>
            <DialogTitle>Send Instruments to Calibration Agency</DialogTitle>
            <DialogDescription>
              Enter agency email, review selected instruments and add description.
            </DialogDescription>
          </DialogHeader>

          {/* Agency Email Input */}
          <div className="space-y-2">
            <Label>Calibration Agency Email</Label>
            <Input
              type="email"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              placeholder="Enter agency email"
            />
          </div>

          {/* Selected Instruments List */}
          <div className="space-y-2">
            <Label>Selected Instruments</Label>

            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">

              {Object.keys(selected)
                .filter((id) => selected[id])
                .map((id) => {
                  const item = data.items.find((i) => i.id === id);
                  if (!item) return null;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-muted p-2 rounded-md"
                    >
                      <div className="text-sm">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.id_code}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelected((prev) => {
                            const copy = { ...prev };
                            delete copy[item.id];
                            return copy;
                          })
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}

              {Object.keys(selected).filter((id) => selected[id]).length === 0 && (
                <p className="text-sm text-muted-foreground">No instruments selected</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description for the agency…"
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isSendCalibration}
              onClick={handleSendMail}
            >
              {isSendCalibration ? 'Mail Sending...' : 'Send Mail'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>


    </>

  );
}
