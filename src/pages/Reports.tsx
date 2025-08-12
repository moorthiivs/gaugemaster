import { useState } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { generateReport } from "@/lib/api";
import api from "@/lib/apis";
import { useAuth } from "@/lib/auth";

export default function Reports() {


  const { user } = useAuth()



  const [fromDate, setFromDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), 0, 1)
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), 11, 31)
  );
  const [formatType, setFormatType] = useState<"csv" | "pdf">("csv");

  // Convert to ISO strings for API/report generation
  const from = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
  const to = toDate ? format(toDate, "yyyy-MM-dd") : "";

  const onGenerate = async () => {
    if (!from || !to) return alert("Please select both from and to dates");

    try {
      const response = await api.get('/reports', {
        params: { from, to, format: formatType, userid: user.id },
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${from}_${to}.${formatType}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate report", error);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate report</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        {/* From date */}
        <div>
          <label className="text-sm">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!fromDate ? "text-muted-foreground" : ""
                  }`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fromDate ? format(fromDate, "yyyy-MM-dd") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => date && setFromDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* To date */}
        <div>
          <label className="text-sm">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!toDate ? "text-muted-foreground" : ""
                  }`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {toDate ? format(toDate, "yyyy-MM-dd") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => date && setToDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Format */}
        <div>
          <label className="text-sm">Format</label>
          <Select
            value={formatType}
            onValueChange={(v) => setFormatType(v as "csv" | "pdf")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Generate button */}
        <div className="flex items-end">
          <Button onClick={onGenerate}>Generate</Button>
        </div>
      </CardContent>
    </Card>
  );
}
