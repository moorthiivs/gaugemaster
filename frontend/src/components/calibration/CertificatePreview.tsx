import { useState, useEffect } from "react";
import { CalibrationRecord } from "@/types/calibration";
import { format } from "date-fns";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";

interface CertificatePreviewProps {
  calibration: Partial<CalibrationRecord>;
  instrumentName?: string;
}

/**
 * Live HTML preview matching standard NABL calibration certificate layout.
 * Formatted according to calibration-certificate-01-3487339.jpg layout.
 */
export function CertificatePreview({
  calibration,
  instrumentName,
}: CertificatePreviewProps) {
  const { user } = useAuth();
  const [certConfig, setCertConfig] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    if (user?.companyId) {
      httpClient
        .get(`/users?companyId=${user.companyId}`)
        .then((res) => {
          if (Array.isArray(res.data)) setUsersList(res.data);
        })
        .catch(() => {});
    }
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.id) return;
    const companyId = user.companyId || "";
    httpClient
      .get("/settings/fetchmailconfig", {
        params: { userId: user.id, companyId },
      })
      .then((res) => {
        if (res.data?.certificateConfig) {
          setCertConfig(res.data.certificateConfig);
        }
      })
      .catch(() => {});
  }, [user?.id, user?.companyId]);

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  const points = calibration.calibration_points || [];
  const env = calibration.environmental_conditions || {
    temperature: "-",
    humidity: "-",
  };
  const inst = calibration.instrument;

  const headerCompanyName = certConfig?.headerCompanyName || "Company Name";
  const headerCompanySubtitle =
    certConfig?.headerCompanySubtitle || "(CALIBRATION LABORATORY)";
  const headerRightBoxText1 = certConfig?.headerRightBoxText1 || "NABL / LAB";
  const headerRightBoxText2 = certConfig?.headerRightBoxText2 || "CC - 2632";
  const footerLine1 = certConfig?.footerLine1 || "CALIBRATION CENTER :";
  const footerLine2 =
    certConfig?.footerLine2 ||
    "Laboratory Address, Behind Main Road, Industrial Zone, State - 440024.";
  const footerLine3 =
    certConfig?.footerLine3 ||
    "Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948";

  const procedureReference =
    (calibration as any).procedure_reference || "AE/CAL-SOP/01";

  const companyLogoPath = certConfig?.companyLogoPath || "";
  const headerDisplayMode = certConfig?.headerDisplayMode || "name";
  const headerBgColor = certConfig?.headerBgColor || "#54c6f3";

  // Helper to render Calibration Results
  const renderCalibrationResult = () => {
    if (!points || points.length === 0) return null;
    const hasDescending = points.some(
      (pt: any) =>
        pt.descending_reading !== undefined &&
        pt.descending_reading !== null &&
        pt.descending_reading !== 0,
    );
    const unit = points[0]?.unit || "mm";

    const stdColConfig = (calibration as any).standard_columns_config || {};
    const customColDefs: any[] = (calibration as any).custom_columns || (calibration as any).template?.custom_columns || [];
    const customColMap = new Map<string, string>();

    // 1. Populate customColMap from custom_columns definitions (highest priority)
    customColDefs.forEach((col: any) => {
      if (col?.id) {
        const colName = col.label || col.name || col.title || col.header;
        if (colName && !colName.startsWith("col_")) {
          customColMap.set(col.id, colName);
        }
      }
    });

    // 2. Also check standard_columns_config
    Object.entries(stdColConfig).forEach(([key, cfg]: [string, any]) => {
      if (cfg && typeof cfg === "object") {
        const cfgName = cfg.label || cfg.name || cfg.title || cfg.header;
        if (cfgName && !cfgName.startsWith("col_")) {
          customColMap.set(key, cfgName);
        }
      }
    });

    // 3. Check customFields from points
    points.forEach((pt: any) => {
      if (pt.customFields && typeof pt.customFields === "object") {
        Object.entries(pt.customFields).forEach(([key, val]) => {
          if (!customColMap.has(key) || customColMap.get(key)?.startsWith("col_")) {
            if (val && typeof val === "object" && val !== null) {
              const nameInVal = (val as any).name || (val as any).label || (val as any).title || (val as any).header;
              if (nameInVal && !nameInVal.startsWith("col_")) {
                customColMap.set(key, nameInVal);
              }
            }
          }
        });
      }
    });

    const hidden = new Set(calibration.hidden_columns || []);
    const columnOrder =
      calibration.column_order && calibration.column_order.length > 0
        ? calibration.column_order
        : [
            "description",
            "nominal",
            "tolerance",
            "ascending_reading",
            hasDescending ? "descending_reading" : "",
            ...Array.from(customColMap.keys()),
            "error",
          ].filter(Boolean);

    const activeColumns = columnOrder.filter(
      (k) => k !== "pt" && k !== "actions" && !hidden.has(k),
    );

    const colGroupMap = new Map<string, string>();
    Object.entries(stdColConfig).forEach(([key, cfg]: [any, any]) => {
      if (cfg?.groupName) colGroupMap.set(key, cfg.groupName);
    });
    customColDefs.forEach((col: any) => {
      if (col?.groupName) colGroupMap.set(col.id, col.groupName);
    });
    const getColGroup = (colId: string) => colGroupMap.get(colId);

    const activeColumnsNoStatus = activeColumns.filter((k) => k !== "status");
    const hasAnyGroups = activeColumnsNoStatus.some((k) => getColGroup(k));

    const topRowCells: {
      type: "group" | "single";
      groupName?: string;
      colSpan: number;
      colKeys: string[];
    }[] = [];
    if (hasAnyGroups) {
      let currentGroup: string | undefined = undefined;
      let currentGroupKeys: string[] = [];
      for (const colKey of activeColumnsNoStatus) {
        const g = getColGroup(colKey);
        if (g) {
          if (currentGroup === g) {
            currentGroupKeys.push(colKey);
          } else {
            if (currentGroup)
              topRowCells.push({
                type: "group",
                groupName: currentGroup,
                colSpan: currentGroupKeys.length,
                colKeys: currentGroupKeys,
              });
            currentGroup = g;
            currentGroupKeys = [colKey];
          }
        } else {
          if (currentGroup) {
            topRowCells.push({
              type: "group",
              groupName: currentGroup,
              colSpan: currentGroupKeys.length,
              colKeys: currentGroupKeys,
            });
            currentGroup = undefined;
            currentGroupKeys = [];
          }
          topRowCells.push({ type: "single", colSpan: 1, colKeys: [colKey] });
        }
      }
      if (currentGroup)
        topRowCells.push({
          type: "group",
          groupName: currentGroup,
          colSpan: currentGroupKeys.length,
          colKeys: currentGroupKeys,
        });
    }

    const renderCellTitle = (k: string) => {
      if (k === "description") return "Description";
      if (k === "nominal") return "Nominal";
      if (k === "tolerance") return "Tolerance";
      if (k === "ascending_reading")
        return hasDescending ? "Ascending" : "Actual";
      if (k === "descending_reading") return "Descending";
      if (k === "error") return "Error";

      const mapped = customColMap.get(k);
      if (mapped && !mapped.startsWith("col_")) return mapped;

      const def = customColDefs.find((c: any) => c.id === k || c.key === k || c.field === k);
      if (def) {
        const defName = def.label || def.name || def.title || def.header;
        if (defName && !defName.startsWith("col_")) return defName;
      }

      const stdCfg = stdColConfig[k];
      if (stdCfg) {
        const stdName = stdCfg.label || stdCfg.name || stdCfg.title || stdCfg.header;
        if (stdName && !stdName.startsWith("col_")) return stdName;
      }

      if (k.startsWith("col_")) return "Remark";

      return k;
    };

    return (
      <div className="border border-black flex flex-col divide-y divide-black">
        <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5">
          Calibration Result (ALL VALUES ARE IN {unit})
        </div>
        {(calibration as any).acceptance_criteria?.enabled && (
          <div className="bg-amber-100 text-black text-[9px] font-bold px-2 py-0.5 text-center">
            Acceptance Criteria:{" "}
            {(calibration as any).acceptance_criteria.value}{" "}
            {(calibration as any).acceptance_criteria.type === "percentage"
              ? "%"
              : unit}
          </div>
        )}
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            {!hasAnyGroups ? (
              <tr className="bg-slate-100 border-b border-black font-bold text-center">
                <th className="border-r border-black p-1 w-12 align-middle">
                  Sr No.
                </th>
                {activeColumnsNoStatus.map((k) => (
                  <th
                    key={k}
                    className="border-r border-black p-1 align-middle"
                  >
                    {renderCellTitle(k)}
                  </th>
                ))}
                <th className="p-1 align-middle">Status</th>
              </tr>
            ) : (
              <>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  <th
                    className="border-r border-black p-1 w-12 align-middle"
                    rowSpan={2}
                  >
                    Sr No.
                  </th>
                  {topRowCells.map((cell, idx) => {
                    if (cell.type === "group") {
                      return (
                        <th
                          key={`group-${idx}`}
                          colSpan={cell.colSpan}
                          className="border-r border-b border-black p-1 align-middle"
                        >
                          {cell.groupName}
                        </th>
                      );
                    } else {
                      return (
                        <th
                          key={`single-${cell.colKeys[0]}`}
                          rowSpan={2}
                          className="border-r border-black p-1 align-middle"
                        >
                          {renderCellTitle(cell.colKeys[0])}
                        </th>
                      );
                    }
                  })}
                  <th className="p-1 align-middle" rowSpan={2}>
                    Status
                  </th>
                </tr>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  {activeColumnsNoStatus
                    .filter((k) => getColGroup(k))
                    .map((k) => (
                      <th
                        key={`sub-${k}`}
                        className="border-r border-black p-1 font-normal bg-slate-50"
                      >
                        {renderCellTitle(k)}
                      </th>
                    ))}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {points.map((pt: any, idx: number) => (
              <tr
                key={idx}
                className="text-center border-b border-black font-mono"
              >
                <td className="border-r border-black p-1 font-sans">
                  {String(pt.point_number || idx + 1).padStart(2, "0")}
                </td>
                {activeColumns.map((k) => {
                  if (k === "description")
                    return (
                      <td
                        key={k}
                        className="border-r border-black p-1 font-sans"
                      >
                        {pt.description || "-"}
                      </td>
                    );
                  if (k === "nominal")
                    return (
                      <td key={k} className="border-r border-black p-1">
                        {parseFloat(Number(pt.nominal ?? 0).toFixed(4))}
                      </td>
                    );
                  if (k === "tolerance")
                    return (
                      <td key={k} className="border-r border-black p-1">
                        {parseFloat(Number(pt.tolerance ?? 0).toFixed(4))}
                      </td>
                    );
                  if (k === "ascending_reading")
                    return (
                      <td key={k} className="border-r border-black p-1">
                        {parseFloat(
                          Number(pt.ascending_reading ?? 0).toFixed(4),
                        )}
                      </td>
                    );
                  if (k === "descending_reading")
                    return (
                      <td key={k} className="border-r border-black p-1">
                        {parseFloat(
                          Number(pt.descending_reading ?? 0).toFixed(4),
                        )}
                      </td>
                    );
                  if (k === "error")
                    return (
                      <td key={k} className="border-r border-black p-1">
                        {parseFloat(Number(pt.error ?? 0).toFixed(4))}
                      </td>
                    );
                  if (k === "status") return null;
                  const obj = pt.customFields?.[k];
                  const displayVal =
                    typeof obj === "object" && obj !== null && "value" in obj
                      ? obj.value
                      : (obj ?? "-");
                  return (
                    <td key={k} className="border-r border-black p-1">
                      {String(displayVal)}
                    </td>
                  );
                })}
                <td
                  className={`p-1 font-bold font-sans ${pt.status === "PASS" ? "text-emerald-700" : pt.status === "FAIL" ? "text-red-700" : ""}`}
                >
                  {pt.status || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-1.5 text-[9px] font-bold text-center bg-slate-50 mt-auto">
          Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of
          confidence Level = ±{calibration.uncertainty || "0.00"} {unit}
        </div>
      </div>
    );
  };

  const numPoints = points.length;
  const totalPages = numPoints <= 21 ? 1 : 1 + Math.ceil((numPoints - 21) / 35);
  const sheetNoText = `1 of ${totalPages}`;

  return (
    <div className="bg-white text-black border border-slate-300 rounded-md shadow-2xl overflow-hidden text-[10px] leading-tight font-sans mx-auto flex flex-col w-[794px] max-w-full min-h-[1123px] print:min-h-[100vh] print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:m-0">
      {/* ── 1. HEADER SECTION (Full Width Edge-to-Edge Banner) ── */}
      <div
        className="p-3 text-black w-full"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 max-w-[200px]">
            {companyLogoPath &&
              (headerDisplayMode === "logo" ||
                headerDisplayMode === "both") && (
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL || ""}${companyLogoPath}`}
                  alt="Logo"
                  className="max-h-9 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            {(headerDisplayMode === "name" ||
              headerDisplayMode === "both" ||
              !companyLogoPath) && (
              <div>
                <h1 className="text-xs font-extrabold text-black uppercase leading-tight">
                  {headerCompanyName}
                </h1>
                <p className="text-[8px] font-bold text-black tracking-wider mt-0.5">
                  {headerCompanySubtitle}
                </p>
              </div>
            )}
          </div>
          <div className="text-center flex-1">
            <h2 className="text-[25px] font-black tracking-tighter uppercase text-white leading-none scale-y-110 origin-center">
              CALIBRATION CERTIFICATE
            </h2>
          </div>
          <div className="text-right text-black min-w-[80px]">
            <div className="text-[8px] font-bold">{headerRightBoxText1}</div>
            <div className="text-[9.5px] font-black">{headerRightBoxText2}</div>
          </div>
        </div>
      </div>

      {/* ── 2. BODY CONTENT SECTION ── */}
      <div className="p-3 space-y-3 flex-1 flex flex-col">
        <div className="border border-black p-2 space-y-3 flex-1">
          {/* Top Certificate Metadata Grid */}
          <table className="w-full border-collapse border border-black text-[9px]">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="border-r border-black p-1">Calibration On</th>
                <th className="border-r border-black p-1">
                  Next Calibration Due
                </th>
                <th className="border-r border-black p-1">Certificate No.:</th>
                {calibration.ulr_number && (
                  <th className="border-r border-black p-1">ULR No.</th>
                )}
                <th className="border-r border-black p-1">Certi Issue Date</th>
                <th className="p-1">Sheet No.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center font-semibold">
                <td className="border-r border-black p-1">
                  {fmtDate(calibration.calibration_date)}
                </td>
                <td className="border-r border-black p-1">
                  {fmtDate(calibration.next_calibration_date)}
                </td>
                <td className="border-r border-black p-1 font-bold">
                  {calibration.certificate_number || "—"}
                </td>
                {calibration.ulr_number && (
                  <td className="border-r border-black p-1 font-bold text-slate-800">
                    {calibration.ulr_number}
                  </td>
                )}
                <td className="border-r border-black p-1">
                  {fmtDate(
                    calibration.certificate_issue_date ||
                      calibration.calibration_date,
                  )}
                </td>
                <td className="p-1">{sheetNoText}</td>
              </tr>
            </tbody>
          </table>

          {/* Customer & Reference Grid */}
          <table className="w-full border-collapse border border-black text-[9.5px]">
            <tbody>
              <tr>
                <td className="border-r border-black p-1.5 w-1/2 align-top space-y-0.5">
                  <div className="font-bold text-black text-[10px]">
                    {inst?.location || "M/s Deepshikha Casting Pvt. Ltd."}
                  </div>
                  <div className="text-slate-700 text-[8.5px]">
                    Calibration Customer
                  </div>
                </td>
                <td className="border-r border-black p-1.5 w-1/2 align-top space-y-0.5">
                  <div className="font-bold text-black text-[10px]">
                    {inst?.calibration_source || "M/s Deepshikha Casting Pvt. Ltd."}
                  </div>
                  <div className="text-slate-700 text-[8.5px]">
                    Calibration Location
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Description & Identification */}
          <div className="border-t border-l border-r border-black">
            <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5 border-b border-black">
              Description & Identification
            </div>
            <table className="w-full border-collapse text-[9.5px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1 font-bold w-1/4 pl-2">
                    Instrument (UUC)
                  </td>
                  <td className="border-r border-black p-1 w-1/4 pl-2">
                    {instrumentName || inst?.name || "-"}
                  </td>
                  <td className="border-r border-black p-1 font-bold w-1/4 pl-2">
                    Model No.
                  </td>
                  <td className="p-1 w-1/4 pl-2">{inst?.model_no || "-"}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Make
                  </td>
                  <td className="border-r border-black p-1 pl-2">
                    {inst?.make || "-"}
                  </td>
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Range
                  </td>
                  <td className="p-1 pl-2">{inst?.range || "-"}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Serial No. :
                  </td>
                  <td className="border-r border-black p-1 pl-2">
                    {inst?.serial_no || "-"}
                  </td>
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Least Count
                  </td>
                  <td className="p-1 pl-2">{inst?.least_count || "-"}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1 font-bold pl-2">
                    ID No.
                  </td>
                  <td className="border-r border-black p-1 pl-2">
                    {inst?.id_code || "-"}
                  </td>
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Instrument Cond.
                  </td>
                  <td className="p-1 pl-2">SATISFACTORY</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Calibration Range
                  </td>
                  <td className="border-r border-black p-1 pl-2">
                    {inst?.range || "-"}
                  </td>
                  <td className="border-r border-black p-1 font-bold pl-2">
                    Location
                  </td>
                  <td className="p-1 pl-2">
                    {inst?.location || "Permanent Laboratory"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Procedure & Environmental Conditions */}
          <div className="border border-black p-1.5 space-y-0.5 text-[9.5px]">
            <div className="flex">
              <span className="font-bold w-48">Procedure reference</span>
              <span>: {procedureReference}</span>
            </div>
            <div className="flex">
              <span className="font-bold w-48">Environmental Conditions</span>
              <span>
                : Temperature at {env.temperature}° C RH {env.humidity} %
              </span>
            </div>
            <div className="flex">
              <span className="font-bold w-48">Standard Reference</span>
              <span>
                : {(calibration as any).standard_reference || calibration.remarks || "Standard calibration per ISO/IEC 17025"}
              </span>
            </div>
            <div className="flex">
              <span className="font-bold w-48">Discipline</span>
              <span>: DIMENSION (Basic Measuring Instrument, Gauge etc)</span>
            </div>
          </div>

          {/* Traceability of Master Used */}
          <div className="border border-black flex flex-col divide-y divide-black">
            <div className="bg-slate-200 text-black text-[10px] font-bold px-2 py-0.5">
              TRACEABILITY OF MASTER USED :
            </div>
            {calibration.reference_standards?.length > 0 ? (
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold text-center">
                    <th className="border-r border-black p-1">
                      Instrument Desc.
                    </th>
                    <th className="border-r border-black p-1">Make</th>
                    <th className="border-r border-black p-1">
                      Sr No / Id. No.
                    </th>
                    <th className="border-r border-black p-1">Cert.No.</th>
                    <th className="border-r border-black p-1">Validity</th>
                    <th className="p-1">Cal.Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.reference_standards.map(
                    (ref: any, idx: number) => (
                      <tr key={idx} className="text-center ">
                        <td className="border-r border-black p-1">
                          {ref.name || ref.instrument_desc || ref.description || "-"}
                        </td>
                        <td className="border-r border-black p-1">
                          {ref.make || ref.manufacturer || ref.brand || (calibration as any)?.instrument?.make || "-"}
                        </td>
                        <td className="border-r border-black p-1">
                          {ref.id || ref.id_code || ref.serial_no || ref.sr_no || "-"}
                        </td>
                        <td className="border-r border-black p-1">
                          {ref.cert_no || ref.certificate_no || ref.cert_number || ref.traceable_to || (calibration as any)?.certificate_number || "AE/CC/REF/01"}
                        </td>
                        <td className="border-r border-black p-1">
                          {fmtDate(ref.validity || ref.due_date || ref.valid_till || (calibration as any)?.reference_standard_validity)}
                        </td>
                        <td className="p-1">
                          {ref.agency || ref.cal_agency || ref.calibration_agency || ref.traceable_to || ref.traceable || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source || (calibration as any).instrument.traceable)) || "NABL Lab"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold text-center">
                    <th className="border-r border-black p-1">
                      Instrument Desc.
                    </th>
                    <th className="border-r border-black p-1">Make</th>
                    <th className="border-r border-black p-1">
                      Sr No / Id. No.
                    </th>
                    <th className="border-r border-black p-1">Cert.No.</th>
                    <th className="border-r border-black p-1">Validity</th>
                    <th className="p-1">Cal.Agency</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    <td className="border-r border-black p-1">
                      {(calibration as any)?.reference_standard_name || "Gauge Block Set"}
                    </td>
                    <td className="border-r border-black p-1">
                      {(calibration as any)?.reference_standard_make || (calibration as any)?.instrument?.make || "Standard"}
                    </td>
                    <td className="border-r border-black p-1">
                      {(calibration as any)?.reference_standard_id || "REF-01"}
                    </td>
                    <td className="border-r border-black p-1">
                      {(calibration as any)?.reference_standard_cert_no || (calibration as any)?.reference_standard_traceable_to || (calibration as any)?.certificate_number || "AE/CC/REF/101"}
                    </td>
                    <td className="border-r border-black p-1">
                      {fmtDate((calibration as any)?.reference_standard_validity)}
                    </td>
                    <td className="p-1">
                      {(calibration as any)?.reference_standard_agency || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.reference_standard_traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source)) || "NABL Accredited Lab"}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            <div className="p-1 text-[8px] italic text-slate-700 bg-slate-50 mt-auto">
              All the measurements performed are traceable to National/Int.
              standards through NABL accredited cal.lab.
            </div>
          </div>

          {/* Calibration Result */}
          {renderCalibrationResult()}

          {/* Signature & Authentication Block */}
          {(() => {
            const isImgUrl = (str?: string) =>
              !!str && (str.startsWith("data:image") || str.startsWith("http") || str.startsWith("/"));

            const rawCalibratedSig = (calibration as any).calibrated_by_signature;
            const calibratedSigImg = isImgUrl(rawCalibratedSig)
              ? rawCalibratedSig
              : usersList.find(
                  (u) =>
                    (u.name === calibration.calibrated_by || u.id === calibration.calibrated_by) &&
                    isImgUrl(u.signature),
                )?.signature;

            const rawApprovedSig =
              (calibration as any).approved_by_signature ||
              (calibration as any).reviewed_by_signature;

            const approvedSigImg = isImgUrl(rawApprovedSig)
              ? rawApprovedSig
              : usersList.find(
                  (u) =>
                    (u.name === calibration.approved_by ||
                      u.name === calibration.reviewed_by ||
                      u.id === calibration.approved_by ||
                      u.role === "Quality Manager" ||
                      u.role === "Administrator") &&
                    isImgUrl(u.signature),
                )?.signature;

            return (
              <div className="border border-black p-2 mt-4 grid grid-cols-3 gap-2 items-end">
                <div className="text-center space-y-1">
                  <div className="h-10 flex items-end justify-center">
                    {calibratedSigImg ? (
                      <img
                        src={calibratedSigImg}
                        alt="Signature"
                        className="max-h-9 max-w-[120px] object-contain mx-auto"
                      />
                    ) : (
                      <span className="font-cursive italic text-slate-700 text-xs">
                        {calibration.calibrated_by || "Sign"}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className="font-bold text-[9.5px]">
                      {calibration.calibrated_by || "Calibrated By"}
                    </p>
                    <p className="text-[8.5px] text-slate-600">
                      {calibration.calibrated_by_designation ||
                        "Calibration Engineer"}
                    </p>
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
                  <div className="h-10 flex items-end justify-center">
                    {approvedSigImg ? (
                      <img
                        src={approvedSigImg}
                        alt="Signature"
                        className="max-h-9 max-w-[120px] object-contain mx-auto"
                      />
                    ) : (
                      <span className="font-cursive italic text-slate-700 text-xs">
                        {calibration.approved_by ||
                          calibration.reviewed_by ||
                          "Sign"}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className="font-bold text-[9.5px]">
                      {calibration.approved_by ||
                        calibration.reviewed_by ||
                        "Authorized By"}
                    </p>
                    <p className="text-[8.5px] text-slate-600">
                      {calibration.approved_by_designation || "Quality Manager"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── 3. FOOTER SECTION (Full Width Edge-to-Edge Banner at Bottom) ── */}
      <div
        className="mt-auto w-full border-t border-black p-2 text-[9px] text-center space-y-0.5 text-black font-semibold"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="font-extrabold uppercase text-[9.5px]">
          {footerLine1 || "CALIBRATION CENTER :"}
        </div>
        <p className="font-bold">
          {footerLine2 ||
            ""}
        </p>
        <p>
          {footerLine3 ||
            "☎ : "}
        </p>
      </div>
    </div>
  );
}
