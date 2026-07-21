import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar, User } from "lucide-react";
import { getCalibrationHistory, downloadCertificate } from "@/lib/calibrationActions";
import { getInstrument } from "@/lib/instrumentActions";
import { CalibrationRecord } from "@/types/calibration";
import { Instrument } from "@/types/instrument";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { format } from "date-fns";

export default function CalibrationHistory() {
  useSEO({ title: "Calibration History — GaugeMaster", description: "View calibration history" });
  const { id } = useParams(); // This is the instrument ID
  const navigate = useNavigate();

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [history, setHistory] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getInstrument(id),
      getCalibrationHistory(id),
    ])
      .then(([inst, hist]) => {
        setInstrument(inst);
        setHistory(hist);
      })
      .catch(() => toast.error("Failed to load calibration history"))
      .finally(() => setLoading(false));
  }, [id]);

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  const handleDownload = async (cal: CalibrationRecord) => {
    try {
      const blob = await downloadCertificate(cal.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cal.certificate_number?.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Certificate not available");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Calibration History</h1>
          {instrument && (
            <p className="text-sm text-muted-foreground">
              {instrument.name} ({instrument.id_code})
            </p>
          )}
        </div>
      </div>

      {/* Instrument Details */}
      {instrument && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-muted-foreground block">Name</span><span className="font-medium">{instrument.name}</span></div>
              <div><span className="text-xs text-muted-foreground block">ID Code</span><span className="font-medium">{instrument.id_code}</span></div>
              <div><span className="text-xs text-muted-foreground block">Make</span><span className="font-medium">{instrument.make || "-"}</span></div>
              <div><span className="text-xs text-muted-foreground block">Range</span><span className="font-medium">{instrument.range || "-"}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : history.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {history.map((cal, idx) => (
              <div key={cal.id} className="relative pl-14">
                {/* Timeline dot */}
                <div className={`absolute left-4 top-5 w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center ${
                  cal.verdict === "PASS" ? "bg-emerald-500" : cal.verdict === "FAIL" ? "bg-red-500" : "bg-amber-500"
                }`}>
                  <span className="text-white text-[8px] font-bold">{idx + 1}</span>
                </div>

                <Card className="transition-all hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-primary">{cal.certificate_number}</span>
                          <VerdictBadge verdict={cal.verdict} size="sm" />
                          {cal.ulr_number && (
                            <Badge variant="outline" className="text-[10px]">ULR: {cal.ulr_number}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">{cal.calibration_type}</Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(cal.calibration_date)}
                          </span>
                          {cal.next_calibration_date && (
                            <span>Next Due: {fmtDate(cal.next_calibration_date)}</span>
                          )}
                          {cal.calibrated_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {cal.calibrated_by}
                            </span>
                          )}
                        </div>

                        {cal.uncertainty && (
                          <p className="text-xs"><b>Uncertainty:</b> {cal.uncertainty}</p>
                        )}
                        {cal.remarks && (
                          <p className="text-xs text-muted-foreground">{cal.remarks}</p>
                        )}
                      </div>

                      {cal.certificate_generated && (
                        <Button variant="outline" size="sm" onClick={() => handleDownload(cal)} className="gap-1 text-xs shrink-0">
                          <Download className="w-3 h-3" />
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No calibration history for this instrument</p>
          <Button onClick={() => navigate(`/calibration/new/${id}`)} className="mt-4 gap-2">
            Start First Calibration
          </Button>
        </div>
      )}
    </div>
  );
}
