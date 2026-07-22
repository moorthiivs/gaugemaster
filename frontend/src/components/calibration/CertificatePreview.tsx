import { CalibrationRecord } from "@/types/calibration";
import { format } from "date-fns";

interface CertificatePreviewProps {
  calibration: Partial<CalibrationRecord>;
  instrumentName?: string;
}

/**
 * Live HTML preview matching standard NABL calibration certificate layout.
 * Formatted according to calibration-certificate-01-3487339.jpg layout.
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
  const inst = calibration.instrument;

  return (
    <div className="bg-white text-black border border-slate-400 rounded-sm shadow-lg overflow-hidden text-[10px] leading-tight font-sans" style={{ maxWidth: 750 }}>
      {/* Header Banner */}
      <div className="p-3 border-b border-black space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <h1 className="text-sm font-bold text-black uppercase leading-none">
              ACME ENTERPRISES
            </h1>
            <p className="text-[8px] font-bold text-slate-600 tracking-wider">
              (CALIBRATION LABORATORY)
            </p>
          </div>
          <div className="text-center">
            <h2 className="text-base font-extrabold tracking-wider text-sky-700 uppercase">
              CALIBRATION CERTIFICATE
            </h2>
          </div>
          <div className="text-right border border-black px-1.5 py-0.5 rounded min-w-[70px]">
            <div className="text-[7.5px] font-bold">NABL / LAB</div>
            <div className="text-[8.5px] font-black">CC - 2632</div>
          </div>
        </div>

        {/* Top 5-Column Certificate Metadata Grid */}
        <table className="w-full border-collapse border border-black text-[9px]">
          <thead>
            <tr className="bg-slate-100 border-b border-black text-center font-bold">
              <th className="border-r border-black p-1 w-1/5">Calibration On</th>
              <th className="border-r border-black p-1 w-1/5">Next Calibration Due</th>
              <th className="border-r border-black p-1 w-1/5">Certificate No.:</th>
              <th className="border-r border-black p-1 w-1/5">Certi Issue Date</th>
              <th className="p-1 w-1/5">Sheet No.</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center font-semibold">
              <td className="border-r border-black p-1">{fmtDate(calibration.calibration_date)}</td>
              <td className="border-r border-black p-1">{fmtDate(calibration.next_calibration_date)}</td>
              <td className="border-r border-black p-1 font-bold">{calibration.certificate_number || "—"}</td>
              <td className="border-r border-black p-1">{fmtDate(calibration.calibration_date)}</td>
              <td className="p-1">1 of 1</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-4 space-y-3">
        {/* Customer & Location Grid */}
        <table className="w-full border-collapse border border-black text-[9.5px]">
          <tbody>
            <tr>
              <td className="border-r border-b border-black p-1.5 w-1/2 align-top space-y-0.5">
                <div className="font-bold text-black text-[10px]">
                  {inst?.location || "M/s Customer Name"}
                </div>
                <div className="text-slate-700 text-[9px]">
                  Calibration Customer / Address Details
                </div>
              </td>
              <td className="border-b border-black p-1.5 w-1/2 align-top">
                <div className="flex justify-between">
                  <span className="font-bold">Location of Calibration</span>
                  <span>: Permanent Laboratory</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Description & Identification */}
        <div className="border border-black">
          <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5 border-b border-black">
            Description & Identification
          </div>
          <div className="p-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[9.5px]">
            <div className="flex">
              <span className="font-bold w-36">Instrument (UUC)</span>
              <span>: {instrumentName || inst?.name || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28">Model No.</span>
              <span>: {inst?.model_no || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-36">Make</span>
              <span>: {inst?.make || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28">Range</span>
              <span>: {inst?.range || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-36">Serial No.</span>
              <span>: {inst?.serial_no || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28">Least Count</span>
              <span>: {inst?.least_count || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-36">ID No.</span>
              <span>: {inst?.id_code || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28">Instrument Cond.</span>
              <span>: SATISFACTORY</span>
            </div>
            <div className="flex">
              <span className="font-bold w-36">Calibration Range</span>
              <span>: {inst?.range || "-"}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-28">Location</span>
              <span>: {inst?.location || "Permanent Laboratory"}</span>
            </div>
          </div>
          <div className="border-t border-slate-300 p-1.5 space-y-0.5 text-[9px] bg-slate-50">
            <div className="flex">
              <span className="font-bold w-40">Procedure reference</span>
              <span>: AE/CAL-SOP/01</span>
            </div>
            <div className="flex">
              <span className="font-bold w-40">Environmental Conditions</span>
              <span>: Temperature at {env.temperature}° C  RH {env.humidity} %</span>
            </div>
            <div className="flex">
              <span className="font-bold w-40">Standard Reference</span>
              <span>: IS / ISO Standard Calibration Guidelines</span>
            </div>
            <div className="flex">
              <span className="font-bold w-40">Discipline</span>
              <span>: DIMENSION (Basic Measuring Instrument, Gauge etc)</span>
            </div>
          </div>
        </div>

        {/* Traceability of Master Used */}
        <div className="border border-black">
          <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5 border-b border-black">
            TRACEABILITY OF MASTER USED :
          </div>
          {calibration.reference_standards?.length > 0 ? (
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  <th className="border-r border-black p-1">Instrument Desc.</th>
                  <th className="border-r border-black p-1">Make</th>
                  <th className="border-r border-black p-1">Sr No / Id. No.</th>
                  <th className="border-r border-black p-1">Cert.No.</th>
                  <th className="border-r border-black p-1">Dt.of Cal</th>
                  <th className="border-r border-black p-1">Due Dt.</th>
                  <th className="p-1">Cal.Agency</th>
                </tr>
              </thead>
              <tbody>
                {calibration.reference_standards.map((ref: any, idx: number) => (
                  <tr key={idx} className="text-center border-b border-slate-200">
                    <td className="border-r border-slate-300 p-1">{ref.name || "-"}</td>
                    <td className="border-r border-slate-300 p-1">{ref.make || "-"}</td>
                    <td className="border-r border-slate-300 p-1">{ref.id || "-"}</td>
                    <td className="border-r border-slate-300 p-1">{ref.cert_no || "AE/CC/REF/01"}</td>
                    <td className="border-r border-slate-300 p-1">{fmtDate(ref.cal_date || calibration.calibration_date)}</td>
                    <td className="border-r border-slate-300 p-1">{fmtDate(ref.validity)}</td>
                    <td className="p-1">NABL Lab</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  <th className="border-r border-black p-1">Instrument Desc.</th>
                  <th className="border-r border-black p-1">Make</th>
                  <th className="border-r border-black p-1">Sr No / Id. No.</th>
                  <th className="border-r border-black p-1">Cert.No.</th>
                  <th className="border-r border-black p-1">Dt.of Cal</th>
                  <th className="border-r border-black p-1">Due Dt.</th>
                  <th className="p-1">Cal.Agency</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-center">
                  <td className="border-r border-slate-300 p-1">{calibration.reference_standard_name || "Gauge Block Set"}</td>
                  <td className="border-r border-slate-300 p-1">Standard</td>
                  <td className="border-r border-slate-300 p-1">{calibration.reference_standard_id || "REF-01"}</td>
                  <td className="border-r border-slate-300 p-1">AE/CC/REF/101</td>
                  <td className="border-r border-slate-300 p-1">{fmtDate(calibration.calibration_date)}</td>
                  <td className="border-r border-slate-300 p-1">{fmtDate(calibration.reference_standard_validity)}</td>
                  <td className="p-1">NABL Accredited Lab</td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="p-1 text-[8px] italic border-t border-black text-slate-700 bg-slate-50">
            All the measurements performed are traceable to National/Int. standards through NABL accredited cal.lab.
          </div>
        </div>

        {/* Calibration Result */}
        {points.length > 0 && (() => {
          const hasDescription = points.some((pt: any) => pt.description && String(pt.description).trim() !== "");
          const hasDescending = points.some((pt: any) => pt.descending_reading !== undefined && pt.descending_reading !== null && pt.descending_reading !== 0);
          const unit = points[0]?.unit || "mm";

          const customColMap = new Map<string, string>();
          points.forEach((pt: any) => {
            if (pt.customFields && typeof pt.customFields === "object") {
              Object.entries(pt.customFields).forEach(([key, val]) => {
                if (val && typeof val === "object" && "name" in val) {
                  customColMap.set(key, (val as any).name);
                } else if (typeof val !== "object" && val !== null && val !== undefined) {
                  customColMap.set(key, key);
                }
              });
            }
          });
          const customKeys = Array.from(customColMap.keys());

          return (
            <div className="border border-black">
              <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5 border-b border-black">
                Calibration Result (ALL VALUES ARE IN {unit})
              </div>
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold text-center">
                    <th className="border-r border-black p-1 w-12">Sr No.</th>
                    {hasDescription && <th className="border-r border-black p-1">Description</th>}
                    <th className="border-r border-black p-1">STANDARD VALUE</th>
                    <th className="border-r border-black p-1">{hasDescending ? "AVG OBS VALUE (ASC)" : "AVG OBS VALUE UUC"}</th>
                    {hasDescending && <th className="border-r border-black p-1">AVG OBS VALUE (DESC)</th>}
                    {customKeys.map((k) => (
                      <th key={k} className="border-r border-black p-1">{customColMap.get(k) || k}</th>
                    ))}
                    <th className="border-r border-black p-1">ERROR</th>
                    <th className="p-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((pt: any, idx: number) => (
                    <tr key={idx} className="text-center border-b border-slate-200 font-mono">
                      <td className="border-r border-slate-300 p-1 font-sans">{String(pt.point_number || idx + 1).padStart(2, "0")}</td>
                      {hasDescription && <td className="border-r border-slate-300 p-1 font-sans">{pt.description || "-"}</td>}
                      <td className="border-r border-slate-300 p-1">{Number(pt.nominal).toFixed(4)}</td>
                      <td className="border-r border-slate-300 p-1">{Number(pt.ascending_reading).toFixed(4)}</td>
                      {hasDescending && <td className="border-r border-slate-300 p-1">{Number(pt.descending_reading ?? 0).toFixed(4)}</td>}
                      {customKeys.map((k) => {
                        const obj = pt.customFields?.[k];
                        const displayVal = typeof obj === "object" && obj !== null && "value" in obj ? obj.value : (obj ?? "-");
                        return <td key={k} className="border-r border-slate-300 p-1">{String(displayVal)}</td>;
                      })}
                      <td className="border-r border-slate-300 p-1">{Number(pt.error ?? 0).toFixed(4)}</td>
                      <td className={`p-1 font-bold font-sans ${pt.status === "PASS" ? "text-emerald-700" : pt.status === "FAIL" ? "text-red-700" : ""}`}>
                        {pt.status || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-1.5 text-[9px] font-bold border-t border-black text-center bg-slate-50">
                Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of confidence Level = ±{calibration.uncertainty || "0.00"}{unit}
              </div>
            </div>
          );
        })()}

        {/* Signature & Authentication Block */}
        <div className="border border-black p-2 mt-4 grid grid-cols-3 gap-2 items-end">
          <div className="text-center space-y-1">
            <div className="h-8 flex items-end justify-center font-cursive italic text-slate-700 text-xs">
              {calibration.calibrated_by || "Sign"}
            </div>
            <div className="border-t border-black pt-0.5">
              <p className="font-bold text-[9.5px]">{calibration.calibrated_by || "Calibrated By"}</p>
              <p className="text-[8.5px] text-slate-600">{calibration.calibrated_by_designation || "Calibration Engineer"}</p>
              {calibration.ulr_number && (
                <p className="text-[8px] font-mono font-bold text-slate-700 mt-0.5">
                  ULR : {calibration.ulr_number}
                </p>
              )}
            </div>
          </div>

          <div className="text-center flex flex-col items-center justify-center space-y-1">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-sky-800 flex items-center justify-center text-[7px] font-bold text-sky-900 text-center leading-none p-1">
              CALIBRATION
              <br />
              SEAL / STAMP
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="h-8 flex items-end justify-center font-cursive italic text-slate-700 text-xs">
              {calibration.approved_by || calibration.reviewed_by || "Sign"}
            </div>
            <div className="border-t border-black pt-0.5">
              <p className="font-bold text-[9.5px]">{calibration.approved_by || calibration.reviewed_by || "Authorized By"}</p>
              <p className="text-[8.5px] text-slate-600">{calibration.approved_by_designation || "Quality Manager"}</p>
            </div>
          </div>
        </div>

        {/* Footer Laboratory Address Banner */}
        <div className="border border-black p-1.5 text-[8.5px] text-center space-y-0.5 bg-slate-100">
          <div className="font-bold text-black text-[9px]">CALIBRATION CENTER :</div>
          <p>Laboratory Address, Behind Main Road, Industrial Zone, State - 440024.</p>
          <p className="font-medium text-slate-700">
            Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948
          </p>
        </div>
      </div>
    </div>
  );
}
