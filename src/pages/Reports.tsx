import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";
import { generateReport } from "@/lib/api";

export default function Reports() {
  useSEO({ title: "Reports — Calibration Alerts", description: "Generate CSV or PDF reports for instruments and due dates." });
  const [from, setFrom] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0,10));
  const [format, setFormat] = useState<"csv" | "pdf">("csv");

  const onGenerate = async () => {
    const blob = await generateReport(from, to, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from}_${to}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate report</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="text-sm">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Format</label>
          <Select value={format} onValueChange={(v) => setFormat(v as any)}>
            <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={onGenerate}>Generate</Button>
        </div>
      </CardContent>
    </Card>
  );
}
