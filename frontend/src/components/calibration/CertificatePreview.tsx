import { useState, useEffect, useRef } from "react";
import { CalibrationRecord } from "@/types/calibration";
import { format } from "date-fns";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, ImageIcon, Loader2 } from "lucide-react";

export function formatUncertainty(val?: string | null, unit?: string): string {
  if (!val || !val.trim()) return "";
  const trimmed = val.trim();
  const activeUnit = unit && unit.trim() ? unit.trim() : "";

  if (trimmed.startsWith("±") || /[a-zA-Z]/.test(trimmed)) {
    return trimmed;
  }

  return `±${trimmed}${activeUnit ? ` ${activeUnit}` : ""}`;
}

interface CertificatePreviewProps {
  calibration: Partial<CalibrationRecord>;
  instrumentName?: string;
  showDownloadPng?: boolean;
}

/**
 * Live HTML preview matching standard NABL calibration certificate layout.
 * Formatted according to calibration-certificate-01-3487339.jpg layout.
 */
export function CertificatePreview({
  calibration,
  instrumentName,
  showDownloadPng = true,
}: CertificatePreviewProps) {
  const { user } = useAuth();
  const [certConfig, setCertConfig] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

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
  const docNo =
    calibration.doc_no ||
    (calibration as any).docNo ||
    ((calibration as any).template as any)?.doc_no ||
    ((calibration as any).template as any)?.docNo;
  const headerRightBoxText1 = docNo ? "Doc. No." : (certConfig?.headerRightBoxText1 || "NABL / LAB");
  const headerRightBoxText2 = docNo || certConfig?.headerRightBoxText2 || "CC - 2632";
  const isGauge =
    (inst?.device_type || "").toLowerCase().includes("gauge") ||
    ((inst as any)?.item_type || "").toLowerCase().includes("gauge") ||
    (calibration.calibration_type || "").toLowerCase().includes("gauge");
  const rangeLabel = isGauge ? "Specification" : "Range";
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

  const layoutBlocks =
    (calibration as any).layout_blocks ||
    ((calibration as any).template as any)?.layout_blocks;

  // ── Render Canvas Layout Blocks (Multi-Table, Split-Row, Matrix, Notes) ──
  const renderCanvasLayoutBlocks = (blocks: any[]) => {
    if (!blocks || blocks.length === 0) return null;

    const evalCanvasFormula = (formula: string, row: any, tolerance: number = 0.01): any => {
      if (!formula) return "";
      try {
        let expr = formula;
        const t1 = parseFloat(row.t1 ?? row.col_1) || 0;
        const t2 = parseFloat(row.t2 ?? row.col_2) || 0;
        const t3 = parseFloat(row.t3 ?? row.col_3) || 0;
        const t4 = parseFloat(row.t4 ?? row.col_4) || 0;
        const t5 = parseFloat(row.t5 ?? row.col_5) || 0;
        const nominal = parseFloat(row.nominal) || 0;
        const reading = parseFloat(row.reading ?? row.ascending_reading ?? row.t1) || 0;
        const tol = parseFloat(row.tolerance ?? tolerance) || 0.01;

        const avgMatch = expr.match(/AVERAGE\(([^)]+)\)/i);
        if (avgMatch) {
          const varNames = avgMatch[1].split(",").map((s: string) => s.trim());
          let sum = 0;
          let count = 0;
          varNames.forEach((v: string) => {
            const rawVal = row[v] ?? row[`col_${v}`];
            if (rawVal !== undefined && String(rawVal).trim() !== "") {
              const val = parseFloat(rawVal);
              if (!isNaN(val)) {
                sum += val;
                count++;
              }
            }
          });
          if (count === 0) return "-";
          const avg = sum / count;
          return avg.toFixed(3);
        }

        if (/avg\s*-\s*nominal/i.test(expr)) {
          if (row.avg === undefined && (row.t1 === undefined || String(row.t1).trim() === "")) return "-";
          const avgVal = parseFloat(row.avg ?? row.t1);
          if (isNaN(avgVal)) return "-";
          const err = avgVal - nominal;
          return err >= 0 ? `+${err.toFixed(3)}` : err.toFixed(3);
        }
        if (/reading\s*-\s*nominal/i.test(expr) || /actual\s*-\s*nominal/i.test(expr)) {
          const readStr = row.reading ?? row.ascending_reading ?? row.t1;
          if (readStr === undefined || String(readStr).trim() === "") return "-";
          const readVal = parseFloat(readStr);
          if (isNaN(readVal)) return "-";
          const err = readVal - nominal;
          return err >= 0 ? `+${err.toFixed(3)}` : err.toFixed(3);
        }

        if (/IF\(.*PASS.*FAIL.*\)/i.test(expr)) {
          const hasReading = row.error !== undefined || row.avg !== undefined || (row.reading !== undefined && String(row.reading).trim() !== "") || (row.t1 !== undefined && String(row.t1).trim() !== "");
          if (!hasReading) return "-";
          const errVal = Math.abs(parseFloat(row.error ?? (reading - nominal)) || 0);
          return errVal <= tol ? "PASS" : "FAIL";
        }

        return row[formula] || "-";
      } catch {
        return "-";
      }
    };

    const renderSingleTableGrid = (tbl: any) => {
      const unitStr = tbl.unit || "mm";

      if (tbl.orientation === "horizontal") {
        const displayCols = tbl.columns.filter((c: any) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino");
        const dec = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;

        return (
          <div key={tbl.id} className="border border-black flex flex-col divide-y divide-black bg-white">
            <div className="bg-slate-200 text-black text-[9px] font-bold py-0.5 px-2 text-center uppercase tracking-wide">
              {tbl.title} {unitStr ? `(ALL VALUES ARE IN ${unitStr})` : ""}
            </div>
            <div>
              <table className="w-full border-collapse text-[7.5px] text-center" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-bold divide-x divide-black">
                    <th className="py-0.5 px-1 text-left bg-slate-200/50" style={{ width: '18%' }}>
                      Parameter / Sl no
                    </th>
                    {tbl.rows.map((r: any, rIdx: number) => (
                      <th key={rIdx} className="py-0.5 px-0.5 font-bold">
                        {r.point_number ?? (rIdx + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono">
                  {displayCols.map((col: any) => (
                    <tr key={col.id} className="divide-x divide-black">
                      <td className="py-0.5 px-1 text-left font-bold bg-slate-50 text-[7px] overflow-hidden text-ellipsis">
                        {col.label}
                      </td>
                      {tbl.rows.map((row: any, rIdx: number) => {
                        let val: any = row[col.id];
                        if (col.type === "nominal") {
                          val = row.nominal !== undefined ? Number(row.nominal).toFixed(dec) : "-";
                        } else if (col.type === "text") {
                          val = row.description || row[col.id] || "-";
                        } else if (col.type === "formula" || col.type === "status") {
                          val = row[col.id] ?? evalCanvasFormula(col.formula || col.id, row, tbl.tolerance);
                        } else if (val === undefined || val === null || val === "") {
                          val = "-";
                        }

                        const isPass = val === "PASS" || val === "OK";
                        const isFail = val === "FAIL" || val === "REJECT";

                        return (
                          <td
                            key={rIdx}
                            className={`py-0.5 px-0.5 ${
                              isPass ? "text-emerald-700 font-bold" : isFail ? "text-red-600 font-bold" : ""
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tbl.footerNote && (
              <div className="p-1 text-[7.5px] italic text-center bg-slate-50 border-t border-black">
                {tbl.footerNote}
              </div>
            )}
          </div>
        );
      }

      return (
        <div key={tbl.id} className="border border-black flex flex-col divide-y divide-black bg-white">
          <div className="bg-slate-200 text-black text-[9px] font-bold py-0.5 px-2 text-center uppercase tracking-wide">
            {tbl.title} {unitStr ? `(ALL VALUES ARE IN ${unitStr})` : ""}
          </div>
          <table className="w-full border-collapse text-[8px] text-center">
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold divide-x divide-black">
                {tbl.columns.map((col: any) => (
                  <th key={col.id} style={{ width: col.width }} className="py-0.5 px-1">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-mono">
              {tbl.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="divide-x divide-black">
                  {tbl.columns.map((col: any) => {
                    const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                    let val: any = row[col.id];
                    if (isPointNo) {
                      val = row.point_number ?? row[col.id] ?? (rIdx + 1);
                    } else if (col.type === "nominal") {
                      const decimals = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;
                      val = row.nominal !== undefined ? Number(row.nominal).toFixed(decimals) : "-";
                    } else if (col.type === "text") {
                      val = row.description || row[col.id] || "-";
                    } else if (col.type === "formula" || col.type === "status") {
                      val = row[col.id] ?? evalCanvasFormula(col.formula || col.id, row, tbl.tolerance);
                    } else if (val === undefined || val === null || val === "") {
                      val = "-";
                    }

                    const isPass = val === "PASS" || val === "OK";
                    const isFail = val === "FAIL" || val === "REJECT";

                    return (
                      <td
                        key={col.id}
                        className={`py-0.5 px-1 ${
                          isPass ? "text-emerald-700 font-bold" : isFail ? "text-red-600 font-bold" : ""
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {tbl.footerNote && (
            <div className="p-1 text-[7.5px] italic text-center bg-slate-50 border-t border-black">
              {tbl.footerNote}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col">
        {blocks.map((block: any, idx: number) => {
          const mbStyle = { marginBottom: `${block.marginBottom !== undefined ? block.marginBottom : 6}px` };
          if (block.type === "table_grid") {
            return (
              <div key={block.id || idx} style={mbStyle}>
                {renderSingleTableGrid(block)}
              </div>
            );
          }
          if (block.type === "split_row") {
            return (
              <div key={block.id || idx} style={mbStyle} className={`grid grid-cols-1 md:grid-cols-${block.children?.length || 2} gap-1.5`}>
                {block.children?.map((child: any, cIdx: number) => {
                  const isBlank = !child || child.type === "blank" || child.type === "empty" || (child.type === "text_block" && !child.content?.trim());
                  return (
                    <div key={child?.id || cIdx}>
                      {child?.type === "table_grid" && renderSingleTableGrid(child)}
                      {child?.type === "text_block" && child.content?.trim() && (
                        <div className="p-1 border border-black text-[8px] bg-slate-50 text-center font-medium">
                          {child.content}
                        </div>
                      )}
                      {isBlank && <div className="w-full h-full min-h-[20px]" />}
                    </div>
                  );
                })}
              </div>
            );
          }
          if (block.type === "matrix_table") {
            return (
              <div key={block.id || idx} style={mbStyle} className="border border-black flex flex-col divide-y divide-black bg-white">
                <div className="bg-slate-200 text-black text-[9px] font-bold py-0.5 px-2 text-center uppercase tracking-wide">
                  {block.title}
                </div>
                <table className="w-full border-collapse text-[7.5px] text-center font-mono">
                  <thead>
                    {block.headers?.map((hRow: any[], hIdx: number) => (
                      <tr key={hIdx} className="bg-slate-100 font-bold border-b border-black divide-x divide-black">
                        {hRow.map((cell: any, cIdx: number) => (
                          <th key={cIdx} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="py-0.5 px-1">
                            {cell.text}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-black">
                    {block.rows?.map((row: any[], rIdx: number) => (
                      <tr key={rIdx} className="divide-x divide-black">
                        {row.map((cellVal: any, cIdx: number) => (
                          <td key={cIdx} className="py-0.5 px-1">
                            {cellVal}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (block.type === "text_block") {
            return (
              <div key={block.id || idx} style={mbStyle} className="p-1 border border-black text-[8px] bg-slate-50 text-center font-medium">
                {block.content}
              </div>
            );
          }
          if (block.type === "page_break") {
            return (
              <div key={block.id || idx} className="border-t border-dashed border-slate-400 my-1 pt-0.5 text-center text-[7px] text-muted-foreground print:break-before-page">
                --- PAGE BREAK ---
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  // Helper to render Calibration Results
  const renderCalibrationResult = () => {
    if (layoutBlocks && layoutBlocks.length > 0) {
      return renderCanvasLayoutBlocks(layoutBlocks);
    }

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

    const hidden = new Set(
      calibration.hidden_columns ||
      ((calibration as any).template as any)?.hidden_columns ||
      [],
    );
    const showStatusColumn = !hidden.has("status");
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
      // 1. Check standard column custom configuration first
      const stdCfg = stdColConfig[k];
      if (stdCfg) {
        const stdName = stdCfg.name || stdCfg.label || stdCfg.title || stdCfg.header;
        if (stdName && !stdName.startsWith("col_")) return stdName;
      }

      // 2. Check custom column definitions and point mapping
      const mapped = customColMap.get(k);
      if (mapped && !mapped.startsWith("col_")) return mapped;

      const def = customColDefs.find((c: any) => c.id === k || c.key === k || c.field === k);
      if (def) {
        const defName = def.name || def.label || def.title || def.header;
        if (defName && !defName.startsWith("col_")) return defName;
      }

      // 3. Fallback to standard column default names
      if (k === "description") return "Description";
      if (k === "nominal") return "Nominal";
      if (k === "tolerance") return "Tolerance";
      if (k === "ascending_reading")
        return hasDescending ? "Ascending" : "Actual";
      if (k === "descending_reading") return "Descending";
      if (k === "error") return "Error";

      if (k.startsWith("col_")) return "Remark";

      return k;
    };

    const totalCols = 1 + activeColumnsNoStatus.length + (showStatusColumn ? 1 : 0);
    const dynamicTextSize = totalCols > 10 ? "text-[7.5px]" : totalCols > 7 ? "text-[8.5px]" : isCompact ? "text-[8px]" : "text-[9.5px]";

    return (
      <div className="border border-black flex flex-col divide-y divide-black">
        <div className={`bg-slate-200 text-black ${isCompact ? "text-[8.5px] py-0.5 px-1.5" : "text-[10px] py-0.5 px-2"} font-bold`}>
          Calibration Result (ALL VALUES ARE IN {unit})
        </div>
        {(calibration as any).acceptance_criteria?.enabled && (
          <div className={`bg-amber-100 text-black ${isCompact ? "text-[8px] py-0.5 px-1.5" : "text-[9px] py-0.5 px-2"} font-bold text-center`}>
            Acceptance Criteria:{" "}
            {(calibration as any).acceptance_criteria.value}{" "}
            {(calibration as any).acceptance_criteria.type === "percentage"
              ? "%"
              : unit}
          </div>
        )}
        <table className={`w-full border-collapse ${dynamicTextSize}`}>
          <thead>
            {!hasAnyGroups ? (
              <tr className="bg-slate-100 border-b border-black font-bold text-center">
                <th className={`border-r border-black ${isCompact ? "py-0.5 px-1 w-10" : "p-1 w-12"} align-middle`}>
                  Sr No.
                </th>
                {activeColumnsNoStatus.map((k) => (
                  <th
                    key={k}
                    className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} align-middle`}
                  >
                    {renderCellTitle(k)}
                  </th>
                ))}
                {showStatusColumn && (
                  <th className={`${isCompact ? "py-0.5 px-1 w-12" : "p-1"} align-middle`}>Status</th>
                )}
              </tr>
            ) : (
              <>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  <th
                    className={`border-r border-black ${isCompact ? "py-0.5 px-1 w-10" : "p-1 w-12"} align-middle`}
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
                          className={`border-r border-b border-black ${isCompact ? "py-0.5 px-1" : "p-1"} align-middle`}
                        >
                          {cell.groupName}
                        </th>
                      );
                    } else {
                      return (
                        <th
                          key={`single-${cell.colKeys[0]}`}
                          rowSpan={2}
                          className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} align-middle`}
                        >
                          {renderCellTitle(cell.colKeys[0])}
                        </th>
                      );
                    }
                  })}
                  {showStatusColumn && (
                    <th className={`${isCompact ? "py-0.5 px-1 w-12" : "p-1"} align-middle`} rowSpan={2}>
                      Status
                    </th>
                  )}
                </tr>
                <tr className="bg-slate-100 border-b border-black font-bold text-center">
                  {activeColumnsNoStatus
                    .filter((k) => getColGroup(k))
                    .map((k) => (
                      <th
                        key={`sub-${k}`}
                        className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} font-normal bg-slate-50`}
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
                <td className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} font-sans`}>
                  {String(pt.point_number || idx + 1).padStart(2, "0")}
                </td>
                {activeColumnsNoStatus.map((k) => {
                  if (k === "description")
                    return (
                      <td
                        key={k}
                        className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} font-sans`}
                      >
                        {pt.description || "-"}
                      </td>
                    );
                  if (k === "nominal")
                    return (
                      <td key={k} className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"}`}>
                        {parseFloat(Number(pt.nominal ?? 0).toFixed(4))}
                      </td>
                    );
                  if (k === "tolerance")
                    return (
                      <td key={k} className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"}`}>
                        {parseFloat(Number(pt.tolerance ?? 0).toFixed(4))}
                      </td>
                    );
                  if (k === "ascending_reading")
                    return (
                      <td key={k} className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"}`}>
                        {parseFloat(
                          Number(pt.ascending_reading ?? 0).toFixed(4),
                        )}
                      </td>
                    );
                  if (k === "descending_reading")
                    return (
                      <td key={k} className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"}`}>
                        {parseFloat(
                          Number(pt.descending_reading ?? 0).toFixed(4),
                        )}
                      </td>
                    );
                  if (k === "error")
                    return (
                      <td key={k} className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"}`}>
                        {parseFloat(Number(pt.error ?? 0).toFixed(4))}
                      </td>
                    );
                  const obj = pt.customFields?.[k];
                  const displayVal =
                    typeof obj === "object" && obj !== null && "value" in obj
                      ? obj.value
                      : (obj ?? "-");
                  const isPass = String(displayVal).trim().toUpperCase() === "PASS";
                  const isFail = String(displayVal).trim().toUpperCase() === "FAIL";
                  return (
                    <td
                      key={k}
                      className={`border-r border-black ${isCompact ? "py-0.5 px-1" : "p-1"} ${
                        isPass ? "text-emerald-700 font-bold font-sans" : isFail ? "text-red-700 font-bold font-sans" : ""
                      }`}
                    >
                      {String(displayVal ?? "-")}
                    </td>
                  );
                })}
                {showStatusColumn && (
                  <td
                    className={`${isCompact ? "py-0.5 px-1" : "p-1"} font-bold font-sans ${pt.status === "PASS" ? "text-emerald-700" : pt.status === "FAIL" ? "text-red-700" : ""}`}
                  >
                    {pt.status || "-"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {calibration.uncertainty && calibration.uncertainty.trim() ? (
          <div className={`p-1 text-[8px] font-bold text-center bg-slate-50 mt-auto border-t`}>
            Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of
            confidence Level = {formatUncertainty(calibration.uncertainty, unit)}
          </div>
        ) : null}
      </div>
    );
  };

  const numPoints = points.length;
  const isCompact = numPoints > 7;
  const totalPages = numPoints <= 21 ? 1 : 1 + Math.ceil((numPoints - 21) / 35);
  const sheetNoText = `1 of ${totalPages}`;

  const handleDownloadPng = async () => {
    if (!certRef.current) return;
    try {
      setDownloadingPng(true);
      toast.info("Generating high quality PNG image...");

      if (document.fonts) {
        await document.fonts.ready;
      }

      const certElement = certRef.current;
      const targetWidth = 794;
      const targetHeight = certElement.scrollHeight || certElement.offsetHeight;

      const certNum = (calibration.certificate_number || "CERTIFICATE").replace(/[\/\\]/g, "-");
      const dataUrl = await toPng(certElement, {
        quality: 1.0,
        pixelRatio: 2, // 2x high resolution: 1588px width, zero clipping
        width: targetWidth,
        height: targetHeight,
        style: {
          width: `${targetWidth}px`,
          minWidth: `${targetWidth}px`,
          maxWidth: `${targetWidth}px`,
          height: `${targetHeight}px`,
          margin: "0",
          padding: "0",
          left: "0",
          top: "0",
          position: "static",
          transform: "none",
          boxShadow: "none",
          borderRadius: "0",
          border: "none",
        },
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      saveAs(dataUrl, `Certificate-${certNum}.png`);
      toast.success("High quality PNG certificate downloaded successfully!");
    } catch (err) {
      console.error("Failed to export certificate image", err);
      toast.error("Failed to generate PNG certificate image");
    } finally {
      setDownloadingPng(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-full overflow-x-auto pb-4">
      {/* Action Toolbar */}
      {showDownloadPng !== false && (
        <div className="w-[794px] shrink-0 max-w-full flex justify-end items-center gap-2 mb-2.5 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPng}
            disabled={downloadingPng}
            className="h-8 gap-2 text-xs font-bold bg-white dark:bg-slate-900 border-primary/40 hover:bg-primary/5 hover:border-primary text-primary shadow-xs transition-all cursor-pointer"
          >
            {downloadingPng ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
            )}
            <span>{downloadingPng ? "Exporting High-Res PNG..." : "Download PNG (High Quality)"}</span>
          </Button>
        </div>
      )}

      {/* Main Certificate Sheet */}
      <div
        ref={certRef}
        className="bg-white text-black border border-slate-300 rounded-sm shadow-xl text-[10px] leading-tight font-sans flex flex-col w-[794px] min-w-[794px] max-w-[794px] shrink-0 h-auto overflow-hidden print:min-h-[100vh] print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:m-0"
      >
      {/* ── 1. HEADER SECTION (Full Width Edge-to-Edge Banner) ── */}
      <div
        className="p-2.5 text-black w-full"
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
                  className="max-h-8 w-auto object-contain"
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
                <p className="text-[7.5px] font-bold text-black tracking-wider mt-0.5">
                  {headerCompanySubtitle}
                </p>
              </div>
            )}
          </div>
          <div className="text-center flex-1">
            <h2 className="text-[22px] font-black tracking-tighter uppercase text-white leading-none scale-y-110 origin-center">
              CALIBRATION CERTIFICATE
            </h2>
          </div>
          <div className="text-right text-black min-w-[120px] shrink-0">
            <div className="text-[7.5px] font-bold tracking-tight whitespace-nowrap">{headerRightBoxText1}</div>
            <div className="text-[9px] font-black tracking-tight whitespace-nowrap">{headerRightBoxText2}</div>
          </div>
        </div>
      </div>

      {/* ── 2. BODY CONTENT SECTION ── */}
      <div className="p-2.5 flex flex-col">
        <div className={`border border-black ${isCompact ? "p-1.5 space-y-1.5 text-[8.5px]" : "p-2 space-y-2 text-[9.5px]"}`}>
          {/* Top Certificate Metadata Grid */}
          <table className={`w-full border-collapse border border-black ${isCompact ? "text-[8px]" : "text-[9px]"}`}>
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className={isCompact ? "p-0.5" : "p-1"}>Calibration Location</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Calibration On</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Next Calibration Due</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Certificate No.:</th>
                {calibration.ulr_number && (
                  <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>ULR No.</th>
                )}
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Certi Issue Date</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Sheet No.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center font-semibold">
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"} font-bold text-black`}>
                  {inst?.calibration_source || inst?.location || "Permanent Laboratory"}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                  {fmtDate(calibration.calibration_date)}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                  {fmtDate(calibration.next_calibration_date)}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"} font-bold`}>
                  {calibration.certificate_number || "—"}
                </td>
                {calibration.ulr_number && (
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"} font-bold text-slate-800`}>
                    {calibration.ulr_number}
                  </td>
                )}
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                  {fmtDate(
                    calibration.certificate_issue_date ||
                      calibration.calibration_date,
                  )}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>{sheetNoText}</td>
              </tr>
            </tbody>
          </table>

          {/* Description & Identification (3 Columns Stacked) */}
          <div className="border border-black">
            <div className={`bg-slate-200 text-black ${isCompact ? "text-[8.5px] py-0.5 px-1.5" : "text-[10px] py-0.5 px-2"} font-bold border-b border-black text-center uppercase`}>
              Description & Identification
            </div>
            <table className={`w-full border-collapse ${isCompact ? "text-[7.5px]" : "text-[8.5px]"}`}>
              <tbody>
                <tr className="border-b border-black divide-x divide-black">
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Instrument (UUC)</div>
                    <div className="font-bold">{instrumentName || inst?.name || "-"}</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Make</div>
                    <div className="font-bold">{inst?.make || "-"}</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Model No.</div>
                    <div className="font-bold">{(inst as any)?.model_no || "-"}</div>
                  </td>
                </tr>
                <tr className="border-b border-black divide-x divide-black">
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">{rangeLabel}</div>
                    <div className="font-bold">{inst?.range || "-"}</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Serial No.</div>
                    <div className="font-bold">{inst?.serial_no || "-"}</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Least Count</div>
                    <div className="font-bold">{inst?.least_count || "-"}</div>
                  </td>
                </tr>
                <tr className="divide-x divide-black">
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">ID No.</div>
                    <div className="font-bold">{inst?.id_code || "-"}</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Instrument Cond.</div>
                    <div className="font-bold">SATISFACTORY</div>
                  </td>
                  <td className="w-1/3 p-1">
                    <div className="font-bold text-slate-600 text-[8px]">Location</div>
                    <div className="font-bold">{inst?.location || "Permanent Laboratory"}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Procedure & Environmental Conditions Table */}
          <table className={`w-full border-collapse border border-black ${isCompact ? "text-[7.5px]" : "text-[8.5px]"}`}>
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold divide-x divide-black text-left">
                <th className={`w-[22%] ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Procedure No</th>
                <th className={`w-[38%] ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Standard Reference</th>
                <th className={`w-[40%] ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Discipline</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black divide-x divide-black">
                <td className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>{procedureReference}</td>
                <td className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  {(calibration as any).standard_reference || calibration.remarks || "Standard calibration per ISO/IEC 17025"}
                </td>
                <td className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  {(calibration as any).discipline || "DIMENSION (Basic Measuring Instrument, Gauge etc)"}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"} font-medium`}>
                  <span className="font-bold">Environmental Conditions</span> : Temperature at {env.temperature || "-"}° C RH {env.humidity || "-"} %
                  {Boolean(env.soaking_time || env.soaking_start_time || env.soaking_end_time) && (
                    <span className="ml-3">
                      | <span className="font-bold">Soaking Details:</span> {env.soaking_start_time && `Start: ${env.soaking_start_time} `}
                      {env.soaking_end_time && `| End: ${env.soaking_end_time} `}
                      {env.soaking_time && `| Soaking Time: ${env.soaking_time}`}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Traceability of Master Used */}
          <table className={`w-full border-collapse border border-black ${isCompact ? "text-[8px]" : "text-[9px]"}`}>
            <thead>
              <tr>
                <th colSpan={6} className={`bg-slate-200 text-black ${isCompact ? "text-[8.5px] py-0.5 px-1.5" : "text-[10px] py-0.5 px-2"} font-bold text-left border-b border-black`}>
                  TRACEABILITY OF MASTER USED :
                </th>
              </tr>
              <tr className="bg-slate-100 border-b border-black font-bold text-center">
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                  Instrument Desc.
                </th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Make</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                  Sr No / Id. No.
                </th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Cert.No.</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Validity</th>
                <th className={isCompact ? "p-0.5" : "p-1"}>Cal.Agency</th>
              </tr>
            </thead>
            <tbody>
              {calibration.reference_standards?.length > 0 ? (
                calibration.reference_standards.map(
                  (ref: any, idx: number) => (
                    <tr key={idx} className="text-center border-b border-black">
                      <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                        {ref.name || ref.instrument_desc || ref.description || "-"}
                      </td>
                      <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                        {ref.make || ref.manufacturer || ref.brand || (calibration as any)?.instrument?.make || "-"}
                      </td>
                      <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                        {ref.id || ref.id_code || ref.serial_no || ref.sr_no || "-"}
                      </td>
                      <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                        {ref.cert_no || ref.certificate_no || ref.cert_number || ref.traceable_to || (calibration as any)?.certificate_number || "AE/CC/REF/01"}
                      </td>
                      <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                        {fmtDate(ref.validity || ref.due_date || ref.valid_till || (calibration as any)?.reference_standard_validity)}
                      </td>
                      <td className={isCompact ? "p-0.5" : "p-1"}>
                        {ref.agency || ref.cal_agency || ref.calibration_agency || ref.traceable_to || ref.traceable || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source || (calibration as any).instrument.traceable)) || "NABL Lab"}
                      </td>
                    </tr>
                  ),
                )
              ) : (
                <tr className="text-center border-b border-black">
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                    {(calibration as any)?.reference_standard_name || "Gauge Block Set"}
                  </td>
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                    {(calibration as any)?.reference_standard_make || (calibration as any)?.instrument?.make || "Standard"}
                  </td>
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                    {(calibration as any)?.reference_standard_id || "REF-01"}
                  </td>
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                    {(calibration as any)?.reference_standard_cert_no || (calibration as any)?.reference_standard_traceable_to || (calibration as any)?.certificate_number || "AE/CC/REF/101"}
                  </td>
                  <td className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>
                    {fmtDate((calibration as any)?.reference_standard_validity)}
                  </td>
                  <td className={isCompact ? "p-0.5" : "p-1"}>
                    {(calibration as any)?.reference_standard_agency || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.reference_standard_traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source)) || "NABL Accredited Lab"}
                  </td>
                </tr>
              )}

            </tbody>
          </table>

          {/* Optional Diagram / Schematic Image */}
          {(() => {
            const diagramImage =
              calibration.diagram_image ||
              ((calibration as any).template as any)?.diagram_image;
            if (!diagramImage) return null;

            const diagramWidth =
              calibration.diagram_image_width ||
              ((calibration as any).template as any)?.diagram_image_width ||
              240;
            const diagramHeight =
              calibration.diagram_image_height ||
              ((calibration as any).template as any)?.diagram_image_height ||
              140;
            const diagramAlignment =
              calibration.diagram_image_alignment ||
              ((calibration as any).template as any)?.diagram_image_alignment ||
              "center";

            return (
              <div
                className={`border border-black bg-white p-1.5 flex ${
                  diagramAlignment === "left"
                    ? "justify-start"
                    : diagramAlignment === "right"
                    ? "justify-end"
                    : "justify-center"
                } items-center`}
              >
                <img
                  src={diagramImage}
                  alt="Calibration Diagram"
                  style={{
                    width: `${diagramWidth}px`,
                    maxHeight: `${diagramHeight}px`,
                    objectFit: "contain",
                  }}
                  className="block"
                />
              </div>
            );
          })()}

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
              <div className={`border border-black ${isCompact ? "p-1.5 mt-1.5" : "p-2 mt-3"} grid grid-cols-3 gap-2 items-end`}>
                <div className="text-center space-y-0.5">
                  <div className={`${isCompact ? "h-8" : "h-10"} flex items-end justify-center`}>
                    {calibratedSigImg ? (
                      <img
                        src={calibratedSigImg}
                        alt="Signature"
                        className={`${isCompact ? "max-h-7 max-w-[90px]" : "max-h-9 max-w-[120px]"} object-contain mx-auto`}
                      />
                    ) : (
                      <span className={`font-cursive italic text-slate-700 ${isCompact ? "text-[10px]" : "text-xs"}`}>
                        {calibration.calibrated_by || "Sign"}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className={`font-bold ${isCompact ? "text-[8px]" : "text-[9.5px]"}`}>
                      {calibration.calibrated_by || "Calibrated By"}
                    </p>
                    <p className={`${isCompact ? "text-[7.5px]" : "text-[8.5px]"} text-slate-600`}>
                      {calibration.calibrated_by_designation ||
                        "Calibration Engineer"}
                    </p>
                  </div>
                </div>

                <div className="text-center flex flex-col items-center justify-center space-y-0.5">
                  <img
                    src="/Approved-seal1.png"
                    alt="Approval Seal"
                    className={`${isCompact ? "max-h-9 max-w-[65px]" : "max-h-14 max-w-[85px]"} object-contain mx-auto`}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = "flex";
                      }
                    }}
                  />
                  <div className={`hidden ${isCompact ? "w-10 h-10 text-[6px]" : "w-14 h-14 text-[7px]"} rounded-full border-2 border-dashed border-sky-800 items-center justify-center font-bold text-sky-900 text-center leading-none p-1`}>
                    CALIBRATION
                    <br />
                    SEAL / STAMP
                  </div>
                </div>

                <div className="text-center space-y-0.5">
                  <div className={`${isCompact ? "h-8" : "h-10"} flex items-end justify-center`}>
                    {approvedSigImg ? (
                      <img
                        src={approvedSigImg}
                        alt="Signature"
                        className={`${isCompact ? "max-h-7 max-w-[90px]" : "max-h-9 max-w-[120px]"} object-contain mx-auto`}
                      />
                    ) : (
                      <span className={`font-cursive italic text-slate-700 ${isCompact ? "text-[10px]" : "text-xs"}`}>
                        {calibration.approved_by ||
                          calibration.reviewed_by ||
                          "Sign"}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className={`font-bold ${isCompact ? "text-[8px]" : "text-[9.5px]"}`}>
                      {calibration.approved_by ||
                        calibration.reviewed_by ||
                        "Authorized By"}
                    </p>
                    <p className={`${isCompact ? "text-[7.5px]" : "text-[8.5px]"} text-slate-600`}>
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
        className="mt-auto w-full border-t border-black p-1.5 text-[8.5px] text-center space-y-0.5 text-black font-semibold"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="font-extrabold uppercase text-[9px]">
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
  </div>
  );
}
