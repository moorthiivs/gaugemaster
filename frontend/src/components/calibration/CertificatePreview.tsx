import { CalibrationRecord } from "@/types/calibration";
import { format } from "date-fns";

interface CertificatePreviewProps {
  calibration: Partial<CalibrationRecord>;
  instrumentName?: string;
}

/**
 * Live HTML preview of the calibration certificate.
 * Renders a styled div that matches the PDF output layout.
 */
export function CertificatePreview({ calibration, instrumentName }: CertificatePreviewProps) {
  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  const points = calibration.calibration_points || [];
  const env = calibration.environmental_conditions || { temperature: "-", humidity: "-" };

  return (
    <div className="bg-white text-black border rounded-lg shadow-lg overflow-hidden text-[11px] leading-relaxed" style={{ maxWidth: 680 }}>
      <div className="p-6 space-y-4">
        {/* Title */}
        <div className="text-center border-b pb-3">
          <h2 className="text-lg font-bold tracking-wide text-slate-800">CALIBRATION CERTIFICATE</h2>
          <div className="flex justify-between mt-2 text-[10px] text-slate-500">
            <span><b>Certificate No:</b> {calibration.certificate_number || "—"}</span>
            {calibration.ulr_number && <span><b>ULR No:</b> {calibration.ulr_number}</span>}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
            <span><b>Date of Calibration:</b> {fmtDate(calibration.calibration_date)}</span>
            <span><b>Next Due Date:</b> {fmtDate(calibration.next_calibration_date)}</span>
          </div>
        </div>

        {/* Instrument Details */}
        <div>
          <div className="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-t">INSTRUMENT UNDER CALIBRATION</div>
          <table className="w-full border border-slate-200 text-[10px]">
            <tbody>
              {[
                ["Instrument Name", instrumentName || calibration.instrument?.name || "-"],
                ["ID Code", calibration.instrument?.id_code || "-"],
                ["Make", calibration.instrument?.make || "-"],
                ["Range", calibration.instrument?.range || "-"],
                ["Least Count", calibration.instrument?.least_count || "-"],
                ["Serial No", calibration.instrument?.serial_no || "-"],
                ["Location", calibration.instrument?.location || "-"],
              ].map(([k, v], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                  <td className="border px-2 py-1 font-semibold w-32 text-slate-600">{k}</td>
                  <td className="border px-2 py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reference Standard(s) */}
        <div>
          <div className="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-t">REFERENCE STANDARD / MASTER INSTRUMENT</div>
          {calibration.reference_standards?.length > 0 ? (
            calibration.reference_standards.map((ref: any, idx: number) => (
              <table key={idx} className={`w-full border border-slate-200 text-[10px] ${idx > 0 ? 'mt-2' : ''}`}>
                <tbody>
                  {[
                    ["Name", ref.name || "-"],
                    ["ID / Serial No", ref.id || "-"],
                    ["Traceable To", ref.traceable_to || "-"],
                    ["Range", ref.range || "-"],
                    ["Least Count", ref.least_count || "-"],
                    ["Valid Until", fmtDate(ref.validity)],
                  ].map(([k, v], i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                      <td className="border px-2 py-1 font-semibold w-32 text-slate-600">{k}</td>
                      <td className="border px-2 py-1">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))
          ) : (
            <table className="w-full border border-slate-200 text-[10px]">
              <tbody>
                {[
                  ["Name", calibration.reference_standard_name || "-"],
                  ["ID / Serial No", calibration.reference_standard_id || "-"],
                  ["Traceable To", calibration.reference_standard_traceable_to || "-"],
                  ["Valid Until", fmtDate(calibration.reference_standard_validity)],
                ].map(([k, v], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                    <td className="border px-2 py-1 font-semibold w-32 text-slate-600">{k}</td>
                    <td className="border px-2 py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Environmental Conditions */}
        <div>
          <div className="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-t">ENVIRONMENTAL CONDITIONS</div>
          <div className="border border-slate-200 px-3 py-2 flex gap-6 text-[10px]">
            <span><b>Temperature:</b> {env.temperature}</span>
            <span><b>Humidity:</b> {env.humidity}</span>
            {env.pressure && <span><b>Pressure:</b> {env.pressure}</span>}
          </div>
        </div>

        {/* Calibration Data */}
        {points.length > 0 && (
          <div>
            <div className="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-t">CALIBRATION DATA</div>
            <table className="w-full border border-slate-200 text-[10px]">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border px-2 py-1">Pt</th>
                  <th className="border px-2 py-1">Nominal</th>
                  <th className="border px-2 py-1">Ascending</th>
                  <th className="border px-2 py-1">Descending</th>
                  <th className="border px-2 py-1">Error</th>
                  <th className="border px-2 py-1">Tolerance</th>
                  <th className="border px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {points.map((pt, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-slate-50" : ""}>
                    <td className="border px-2 py-1 text-center">{pt.point_number || idx + 1}</td>
                    <td className="border px-2 py-1 text-center">{pt.nominal}</td>
                    <td className="border px-2 py-1 text-center">{pt.ascending_reading}</td>
                    <td className="border px-2 py-1 text-center">{pt.descending_reading ?? "-"}</td>
                    <td className="border px-2 py-1 text-center font-mono">{pt.error?.toFixed(4)}</td>
                    <td className="border px-2 py-1 text-center">±{pt.tolerance || "-"}</td>
                    <td className={`border px-2 py-1 text-center font-bold ${pt.status === "PASS" ? "text-emerald-600" : pt.status === "FAIL" ? "text-red-600" : ""}`}>
                      {pt.status || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result */}
        <div>
          <div className="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-t">RESULT</div>
          <div className="border border-slate-200 px-3 py-2 text-[10px] space-y-1">
            <p><b>Measurement Uncertainty:</b> {calibration.uncertainty || "-"}</p>
            <p>
              <b>Verdict: </b>
              <span className={`inline-block px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                calibration.verdict === "PASS" ? "bg-emerald-500" : calibration.verdict === "FAIL" ? "bg-red-500" : "bg-amber-500"
              }`}>
                {calibration.verdict || "PENDING"}
              </span>
            </p>
            {calibration.remarks && <p><b>Remarks:</b> {calibration.remarks}</p>}
          </div>
        </div>

        {/* Signature Block */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          {[
            { name: calibration.calibrated_by, title: calibration.calibrated_by_designation || "Calibrated By" },
            { name: calibration.reviewed_by, title: calibration.reviewed_by_designation || "Reviewed By" },
            { name: calibration.approved_by, title: calibration.approved_by_designation || "Approved By" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="border-b border-slate-400 mb-1 h-6" />
              <p className="font-semibold text-[10px]">{s.name || "(Name)"}</p>
              <p className="text-slate-500 text-[9px]">{s.title}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[8px] text-slate-400 mt-4">
          This certificate is issued based on calibration conducted as per standard procedures. The results relate only to the item calibrated.
        </p>
      </div>
    </div>
  );
}
