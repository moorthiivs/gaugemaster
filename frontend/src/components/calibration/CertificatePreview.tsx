import { useState, useEffect, useRef } from "react";
import { CalibrationRecord } from "@/types/calibration";
import { format } from "date-fns";
import httpClient, { API_URL } from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { getEffectiveTableOrientation } from "@/lib/tableLayoutOptimizer";
import { getCoveredCells } from "@/lib/tableSpanUtils";
import { computeHeaderGroups, computeMatrix2DGrid, normalizeMatrixCell, getMatrixTotalCols, normalizeMatrixTableGeometry } from "@/lib/matrixTableUtils";
import { resolveCertificateCellValue } from "@/lib/cellValueResolver";
import { evaluateFormulaExpression, buildRowContext } from "@/lib/formulaEngine";

export function formatUncertainty(val?: string | null, unit?: string): string {
  if (!val || !val.trim()) return "";
  const trimmed = val.trim();
  const activeUnit = unit && unit.trim() ? unit.trim() : "";

  if (trimmed.startsWith("±") || /[a-zA-Z]/.test(trimmed)) {
    return trimmed;
  }

  return `±${trimmed}${activeUnit ? ` ${activeUnit}` : ""}`;
}

function getTextAlignClass(align?: string): string {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}

export interface CanvasBlocksRendererProps {
  blocks: any[];
  isScreen?: boolean;
}

/**
 * Renders canvas-based layout blocks (multi-table, split-row, matrix-table, diagram, text, page break).
 * Supports both print certificate styling (isScreen=false) and responsive dashboard/review modal styling (isScreen=true).
 */
export function CanvasBlocksRenderer({ blocks, isScreen = false }: CanvasBlocksRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  const evalLegacyCanvasFormula = (formula: string, row: any, tolerance: number = 0.02, dec: number = 3): any => {
    if (!formula) return "";
    try {
      let expr = formula.trim();
      const rawNom = (row.nominal_value !== undefined && row.nominal_value !== null && String(row.nominal_value).trim() !== "")
        ? row.nominal_value
        : (row.nominal !== undefined && row.nominal !== null && String(row.nominal).trim() !== "" && row.nominal !== 0 && row.nominal !== "0")
        ? row.nominal
        : row.nom ?? row.std_spec ?? row.std_value ?? row.nominal ?? 0;
      const nominal = parseFloat(String(rawNom)) || 0;
      const tol = parseFloat(String(row.tolerance ?? tolerance)) || 0.02;

      // 1. AVERAGE (ensure it's not a subtraction formula like "average - nominal")
      const isSubtraction = expr.includes("-") || /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr);
      const avgMatch = !isSubtraction && expr.match(/^=?AVERAGE\(([^)]+)\)/i);
      if (avgMatch || (!isSubtraction && (expr.toLowerCase() === "avg" || expr.toLowerCase() === "average"))) {
        let trials: number[] = [];
        if (avgMatch) {
          const varNames = avgMatch[1].split(",").map((s: string) => s.trim());
          varNames.forEach((v: string) => {
            const rawVal = row[v] ?? row[`col_${v}`] ?? row[`t${v}`];
            if (rawVal !== undefined && String(rawVal).trim() !== "") {
              const val = parseFloat(String(rawVal));
              if (!isNaN(val)) trials.push(val);
            }
          });
        }
        if (trials.length === 0) {
          const candidateKeys = [row.t1, row.t2, row.t3, row.t4, row.t5, row.col_1, row.col_2, row.col_3, row.col_4, row.col_5];
          trials = candidateKeys
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
            .map((v) => parseFloat(String(v)))
            .filter((v) => !isNaN(v));
        }
        if (trials.length === 0) return "-";
        const avg = trials.reduce((a, b) => a + b, 0) / trials.length;
        return avg.toFixed(dec);
      }

      // 2. ERROR (measured - nominal or nominal - measured)
      const isError =
        /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr) ||
        /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr) ||
        (/error/i.test(expr) && !/PASS.*FAIL/i.test(expr));

      if (isError) {
        const isInverted = /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr);
        let measuredVal: number | undefined = undefined;

        if (row.avg !== undefined && row.avg !== "-" && String(row.avg).trim() !== "") {
          measuredVal = parseFloat(String(row.avg));
        } else if (row.average !== undefined && row.average !== "-" && String(row.average).trim() !== "") {
          measuredVal = parseFloat(String(row.average));
        } else {
          const trials = [row.t1, row.t2, row.t3, row.t4, row.t5]
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
            .map((v) => parseFloat(String(v)))
            .filter((v) => !isNaN(v));
          if (trials.length > 0) {
            measuredVal = trials.reduce((a, b) => a + b, 0) / trials.length;
          } else if (row.actual_value !== undefined && String(row.actual_value).trim() !== "") {
            measuredVal = parseFloat(String(row.actual_value));
          } else if (row.reading !== undefined && String(row.reading).trim() !== "") {
            measuredVal = parseFloat(String(row.reading));
          } else if (row.ascending_reading !== undefined && String(row.ascending_reading).trim() !== "") {
            measuredVal = parseFloat(String(row.ascending_reading));
          } else if (row.t1 !== undefined && String(row.t1).trim() !== "") {
            measuredVal = parseFloat(String(row.t1));
          }
        }

        if (measuredVal === undefined || isNaN(measuredVal)) return "-";
        const err = isInverted ? nominal - measuredVal : measuredVal - nominal;
        return (err >= 0 ? "+" : "") + err.toFixed(dec);
      }

      // 3. STATUS / JUDGEMENT
      if (
        /IF\(.*PASS.*FAIL.*\)/i.test(expr) ||
        /PASS.*FAIL/i.test(expr) ||
        expr.toLowerCase() === "status" ||
        expr.toLowerCase() === "judgement" ||
        expr.toLowerCase() === "verdict"
      ) {
        const limitMatch = expr.match(/<=\s*([0-9.]+)/i) || expr.match(/<\s*([0-9.]+)/i);
        const tolLimit = limitMatch ? parseFloat(limitMatch[1]) : tol;

        const hasReading =
          (row.error !== undefined && row.error !== "" && row.error !== "-") ||
          (row.avg !== undefined && row.avg !== "" && row.avg !== "-") ||
          (row.average !== undefined && row.average !== "" && row.average !== "-") ||
          (row.reading !== undefined && String(row.reading).trim() !== "" && row.reading !== "-") ||
          (row.t1 !== undefined && String(row.t1).trim() !== "" && row.t1 !== "-");
        if (!hasReading) return "-";

        let errVal: number;
        if (row.error !== undefined && row.error !== "-") {
          errVal = Math.abs(typeof row.error === "number" ? row.error : parseFloat(String(row.error).replace("+", "")) || 0);
        } else {
          const readVal = parseFloat(String(row.avg ?? row.average ?? row.reading ?? row.ascending_reading ?? row.t1 ?? nominal));
          errVal = Math.abs(parseFloat((readVal - nominal).toFixed(dec)) || 0);
        }
        return errVal <= tolLimit + 1e-9 ? "PASS" : "FAIL";
      }

      return row[expr] ?? row[formula] ?? "-";
    } catch {
      return "-";
    }
  };

  const evalCanvasFormula = (
    formula: string,
    row: any,
    tolerance: number = 0.02,
    dec: number = 3,
    col?: any,
    columns: any[] = []
  ): any => {
    if (!formula || typeof formula !== "string" || !formula.trim()) return "";
    try {
      let expr = formula.trim();
      if (expr.startsWith("=")) expr = expr.substring(1).trim();

      const ctx = buildRowContext(row, columns, tolerance, dec);
      const evalRes = evaluateFormulaExpression(expr, ctx, dec);

      if (evalRes.success && evalRes.formatted !== undefined && evalRes.formatted !== null) {
        if (evalRes.formatted === "" || evalRes.formatted === "-") return "-";

        const isErrorCol =
          col?.id === "error" ||
          col?.id === "deviation" ||
          col?.label?.toLowerCase().includes("error") ||
          col?.label?.toLowerCase().includes("deviation") ||
          /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr);

        if (isErrorCol && typeof evalRes.numeric === "number") {
          const rounded = parseFloat(evalRes.numeric.toFixed(dec));
          return (rounded >= 0 ? "+" : "") + rounded.toFixed(dec);
        }

        return evalRes.formatted;
      }

      return evalLegacyCanvasFormula(formula, row, tolerance, dec);
    } catch {
      return evalLegacyCanvasFormula(formula, row, tolerance, dec);
    }
  };

  const renderCellContent = (val: any) => {
    const upperVal = String(val).trim().toUpperCase();
    const isPass = upperVal === "PASS" || upperVal === "OK" || upperVal === "NORMAL";
    const isFail = upperVal === "FAIL" || upperVal === "REJECT" || upperVal === "NOT OK" || upperVal === "NG";

    if (isScreen) {
      if (isPass) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            {val}
          </span>
        );
      }
      if (isFail) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
            {val}
          </span>
        );
      }
      if (val === "-" || val === "" || val === undefined || val === null) {
        return <span className="text-muted-foreground/50">-</span>;
      }
      return <span>{val}</span>;
    }

    if (val === "-" || val === "" || val === undefined || val === null) {
      return <span>-</span>;
    }

    return (
      <span
        className={
          isPass
            ? "text-emerald-700 font-bold"
            : isFail
            ? "text-red-600 font-bold"
            : "text-black"
        }
      >
        {val}
      </span>
    );
  };

  const computeColPercentages = (columns: any[], isHalfRow: boolean = false): string[] => {
    if (!columns || columns.length === 0) return [];
    const netBudget = isHalfRow ? 340 : 700;
    const rawWeights = columns.map((col: any) => {
      if (typeof col.width === "number" && !isNaN(col.width) && col.width > 0) {
        return col.width;
      }
      if (typeof col.width === "string" && col.width.trim() !== "") {
        const s = col.width.trim();
        if (s.endsWith("%")) {
          const pct = parseFloat(s);
          if (!isNaN(pct) && pct > 0) return (pct / 100) * netBudget;
        }
        const parsed = parseFloat(s);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      const cId = String(col.id || col.key || "").toLowerCase();
      const cType = String(col.type || "").toLowerCase();
      if (cId === "point_number" || cId === "sl_no" || cId === "sino" || cId === "sr_no") return 25;
      if (cType === "status" || cId === "judgement" || cId === "status") return 35;
      if (cType === "text" || cId === "specification" || cId === "description" || cId === "parameter") return 70;
      if (cId.includes("master")) return 45;
      return 45;
    });

    const sumRawWeights = rawWeights.reduce((a: number, b: number) => a + b, 0) || 1;
    return rawWeights.map((w: number) => `${((w / sumRawWeights) * 100).toFixed(2)}%`);
  };

  const renderSingleTableGrid = (tbl: any, isHalf: boolean = false) => {
    const unitStr = tbl.unit ? String(tbl.unit).trim() : "";
    const hasTitle = Boolean(tbl.title && String(tbl.title).trim() !== "");
    const titleText = hasTitle
      ? `${String(tbl.title).trim()}${unitStr ? ` (ALL VALUES ARE IN ${unitStr})` : ""}`
      : "";
    const effOrientation = getEffectiveTableOrientation(tbl);

    if (effOrientation === "horizontal") {
      const displayCols = tbl.columns.filter((c: any) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino");
      const dec = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;
      const numDataCols = tbl.rows?.length || 0;

      // Dynamic sizing based on column density
      const isUltraDense = !isScreen && numDataCols > 14;
      const isDense = !isScreen && numDataCols > 8 && numDataCols <= 14;

      const firstColWidthStyle = tbl.firstColWidth
        ? (typeof tbl.firstColWidth === "number" ? `${Math.min(tbl.firstColWidth, isUltraDense ? 100 : isDense ? 115 : 135)}px` : tbl.firstColWidth)
        : tbl.parameterWidth
          ? (typeof tbl.parameterWidth === "number" ? `${Math.min(tbl.parameterWidth, isUltraDense ? 100 : isDense ? 115 : 135)}px` : tbl.parameterWidth)
          : isScreen ? "22%" : isUltraDense ? "14%" : isDense ? "16%" : "18%";

      const dataColWidthStyle = tbl.dataColWidth
        ? (typeof tbl.dataColWidth === "number" ? `${tbl.dataColWidth}px` : tbl.dataColWidth)
        : undefined;

      const dynamicTableTextSize = isScreen
        ? "text-xs"
        : isUltraDense
        ? "text-[6.5px]"
        : isDense
        ? "text-[7px]"
        : "text-[7.5px]";

      const cellPaddingHeader = isScreen
        ? "py-1.5 px-2"
        : isUltraDense
        ? "py-0.5 px-0.5"
        : "py-1 px-1";

      const cellPaddingData = isScreen
        ? "py-1 px-1"
        : isUltraDense
        ? "py-0.5 px-0.5"
        : "py-1 px-1";

      const dataColPercent = numDataCols > 0
        ? `${((100 - (isUltraDense ? 14 : isDense ? 16 : 18)) / numDataCols).toFixed(2)}%`
        : undefined;

      return (
        <div
          key={tbl.id}
          className={
            isScreen
              ? "border border-border/80 rounded-lg overflow-hidden bg-card flex flex-col mb-3 shadow-xs"
              : "border border-black flex flex-col bg-white overflow-hidden"
          }
        >
          {hasTitle && (
            <div
              className={
                isScreen
                  ? "bg-muted/70 text-foreground text-xs font-semibold py-1.5 px-3 text-center uppercase tracking-wide border-b border-border"
                  : "bg-slate-200 text-black text-[9px] font-bold py-1 px-2 text-center uppercase tracking-wide border-b border-black"
              }
            >
              {titleText}
            </div>
          )}
          <div
            className={isScreen ? "w-full overflow-x-auto" : "w-full overflow-hidden"}
            style={!isScreen ? { scrollbarWidth: "none", msOverflowStyle: "none" } : undefined}
          >
            <table
              className={`w-full border-collapse text-center ${dynamicTableTextSize}`}
              style={{ tableLayout: isScreen && dataColWidthStyle ? "auto" : "fixed" }}
            >
              <thead>
                <tr className={isScreen ? "bg-muted/40 font-semibold text-muted-foreground" : "bg-slate-100 font-bold"}>
                  <th
                    className={`${cellPaddingHeader} ${
                      isScreen
                        ? "bg-muted/50 border border-border/70 text-foreground font-semibold"
                        : "bg-slate-200/60 border border-black font-bold text-black"
                    } ${getTextAlignClass(tbl.columns?.[0]?.align || 'center')} break-words whitespace-normal leading-tight`}
                    style={{ width: firstColWidthStyle, minWidth: firstColWidthStyle }}
                  >
                    Parameter / Sl no
                  </th>
                  {tbl.rows.map((r: any, rIdx: number) => (
                    <th
                      key={rIdx}
                      className={`${cellPaddingHeader} font-semibold ${
                        isScreen
                          ? "border border-border/70 text-foreground font-semibold"
                          : "border border-black text-black font-bold"
                      } whitespace-nowrap text-center font-mono`}
                      style={
                        isScreen && dataColWidthStyle
                          ? { width: dataColWidthStyle, minWidth: dataColWidthStyle }
                          : dataColPercent
                          ? { width: dataColPercent }
                          : undefined
                      }
                    >
                      {r.point_number ?? (rIdx + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {displayCols.map((col: any) => {
                  const colAlignClass = getTextAlignClass(col.align || 'center');
                  return (
                    <tr key={col.id} className={isScreen ? "hover:bg-muted/20" : undefined}>
                      <td
                        className={`font-semibold ${
                          isScreen
                            ? "bg-muted/20 text-xs border border-border/70 text-foreground font-sans py-1.5 px-2"
                            : `${isUltraDense ? "text-[6.5px] py-0.5 px-1 leading-tight" : "text-[7px] py-1 px-1.5 leading-snug"} font-sans border border-black text-black font-bold break-words whitespace-normal`
                        } ${colAlignClass}`}
                        style={{ width: firstColWidthStyle, minWidth: firstColWidthStyle }}
                      >
                        {col.label}
                      </td>
                      {tbl.rows.map((row: any, rIdx: number) => {
                        const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                        const val = resolveCertificateCellValue(row, col, {
                          tableTolerance: tbl.tolerance,
                          tableDecimals: colDec,
                          evalFormula: (f: string, r: any, tol: number, d: number) =>
                            evalCanvasFormula(f, r, tol, d, col, tbl.columns || []),
                          rowIndex: rIdx,
                        });

                        return (
                          <td
                            key={rIdx}
                            className={`border ${
                              isScreen ? "border-border/70 text-foreground" : "border border-black text-black"
                            } ${cellPaddingData} whitespace-nowrap text-center font-mono tabular-nums leading-tight`}
                            style={
                              isScreen && dataColWidthStyle
                                ? { width: dataColWidthStyle, minWidth: dataColWidthStyle }
                                : dataColPercent
                                ? { width: dataColPercent }
                                : undefined
                            }
                          >
                            {renderCellContent(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tbl.footerNote && (
            <div
              className={
                isScreen
                  ? "p-2 text-xs italic text-center bg-muted/20 border-t border-border text-muted-foreground"
                  : "p-1 text-[7.5px] italic text-center bg-slate-50 border-t border-black"
              }
            >
              {tbl.footerNote}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={tbl.id}
        className={
          isScreen
            ? "border border-border/80 rounded-lg overflow-hidden bg-card flex flex-col mb-3 shadow-xs"
            : "border border-black flex flex-col bg-white overflow-hidden"
        }
      >
        {hasTitle && (
          <div
            className={
              isScreen
                ? "bg-muted/70 text-foreground text-xs font-semibold py-1.5 px-3 text-center uppercase tracking-wide border-b border-border"
                : "bg-slate-200 text-black text-[9px] font-bold py-1 px-2 text-center uppercase tracking-wide border-b border-black"
            }
          >
            {titleText}
          </div>
        )}
        <div
          className={isScreen ? "w-full overflow-x-auto" : "w-full overflow-hidden"}
          style={!isScreen ? { scrollbarWidth: "none", msOverflowStyle: "none" } : undefined}
        >
          <table
            className={`w-full border-collapse text-center ${
              isScreen
                ? "text-xs"
                : tbl.columns?.length > 11
                ? "text-[6.5px]"
                : tbl.columns?.length > 8
                ? "text-[7.5px]"
                : "text-[8px]"
            }`}
            style={{
              tableLayout: "fixed",
              minWidth: isScreen && (tbl.columns?.length || 0) > 6 ? `${Math.max(620, (tbl.columns?.length || 0) * 65)}px` : undefined,
            }}
          >
            <colgroup>
              {computeColPercentages(tbl.columns || [], isHalf).map((pct, cIdx) => (
                <col key={cIdx} style={{ width: pct }} />
              ))}
            </colgroup>
            <thead>
              {(() => {
                const headerGroups = computeHeaderGroups(tbl.columns || []);
                const colPercentages = computeColPercentages(tbl.columns || [], isHalf);

                if (!headerGroups.hasGroups) {
                  return (
                    <tr className={isScreen ? "bg-muted/40 font-semibold text-muted-foreground" : "bg-slate-100 font-bold"}>
                      {tbl.columns.map((col: any, colIdx: number) => (
                        <th
                          key={col.id}
                          style={{ width: colPercentages[colIdx] }}
                          className={`py-1.5 px-1 border ${
                            isScreen ? "border-border/70 text-foreground font-semibold" : "border border-black text-black font-bold"
                          } ${getTextAlignClass(col.align || 'center')} break-words whitespace-normal leading-tight`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  );
                }

                return (
                  <>
                    <tr className={isScreen ? "bg-muted/40 font-semibold text-muted-foreground" : "bg-slate-100 font-bold"}>
                      {headerGroups.topRow.map((topItem, topIdx) => {
                        if (topItem.type === "group") {
                          return (
                            <th
                              key={`grp_${topIdx}`}
                              colSpan={topItem.colSpan}
                              className={`py-1 px-1 border ${
                                isScreen
                                  ? "border-border/70 text-foreground font-bold uppercase tracking-wider bg-muted/60"
                                  : "border border-black text-black font-bold uppercase tracking-wider bg-slate-200"
                              } break-words whitespace-normal leading-tight`}
                            >
                              {topItem.groupName}
                            </th>
                          );
                        }
                        const col = topItem.columns[0];
                        const colIdx = tbl.columns.findIndex((c: any) => c.id === col.id);
                        return (
                          <th
                            key={col.id}
                            rowSpan={2}
                            style={{ width: colIdx >= 0 ? colPercentages[colIdx] : undefined }}
                            className={`py-1.5 px-1 border ${
                              isScreen ? "border-border/70 text-foreground font-semibold" : "border border-black text-black font-bold"
                            } align-middle ${getTextAlignClass(col.align || 'center')} break-words whitespace-normal leading-tight`}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                    <tr className={isScreen ? "bg-muted/30 font-semibold text-muted-foreground" : "bg-slate-100 font-bold"}>
                      {headerGroups.subRowColumns.map((col: any) => {
                        const colIdx = tbl.columns.findIndex((c: any) => c.id === col.id);
                        return (
                          <th
                            key={col.id}
                            style={{ width: colIdx >= 0 ? colPercentages[colIdx] : undefined }}
                            className={`py-1.5 px-1 border ${
                              isScreen ? "border-border/70 text-foreground font-semibold" : "border border-black text-black font-bold"
                            } ${getTextAlignClass(col.align || 'center')} break-words whitespace-normal leading-tight`}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </>
                );
              })()}
            </thead>
            <tbody className="font-mono">
              {(() => {
                const coveredCells = getCoveredCells(tbl.rows, tbl.columns);
                return tbl.rows.map((row: any, rIdx: number) => {
                  if (row.is_merged || row.isMerged) {
                    return (
                      <tr key={rIdx} className={isScreen ? "hover:bg-muted/20" : undefined}>
                        <td
                          colSpan={tbl.columns.length}
                          className={`py-1.5 px-2 border ${
                            isScreen
                              ? "border-border/70 font-semibold text-left text-foreground bg-muted/20 text-xs"
                              : "border border-black font-semibold text-left text-black bg-slate-50/50"
                          }`}
                        >
                          {row.statement || row.merged_text || row.description || row.required_dimension || "All the jaws are free from dent and damages"}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={rIdx} className={isScreen ? "hover:bg-muted/20" : undefined}>
                      {tbl.columns.map((col: any) => {
                        if (coveredCells.has(`${rIdx}_${col.id}`)) {
                          return null;
                        }
                        const spanInfo = row.cellSpans?.[col.id];
                        const span = spanInfo?.colSpan || 1;
                        const rSpan = spanInfo?.rowSpan || 1;
                        const isMerged = span > 1 || rSpan > 1;

                        const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                        const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                        let val: any = undefined;

                        if (isMerged) {
                          val = (row[col.id] !== undefined && row[col.id] !== "")
                            ? row[col.id]
                            : (col.id === "nominal" ? row.nominal : "") ?? "";
                          return (
                            <td
                              key={col.id}
                              colSpan={span > 1 ? span : undefined}
                              rowSpan={rSpan > 1 ? rSpan : undefined}
                              className={`py-1 px-1 border ${
                                isScreen ? "border-border/70 text-foreground bg-muted/10" : "border border-black text-black bg-slate-50/50"
                              } leading-snug whitespace-pre-line font-semibold text-center align-middle`}
                            >
                              {val}
                            </td>
                          );
                        }

                        if (isPointNo) {
                          val = row.point_number ?? row[col.id] ?? (rIdx + 1);
                          return (
                            <td
                              key={col.id}
                              colSpan={span > 1 ? span : undefined}
                              rowSpan={rSpan > 1 ? rSpan : undefined}
                              className={`py-1 px-1 border ${
                                isScreen ? "border-border/70 text-foreground" : "border border-black text-black"
                              } leading-snug whitespace-pre-line font-semibold text-center align-middle`}
                            >
                              {val}
                            </td>
                          );
                        }

                        val = resolveCertificateCellValue(row, col, {
                          tableTolerance: tbl.tolerance,
                          tableDecimals: colDec,
                          evalFormula: (f: string, r: any, tol: number, d: number) =>
                            evalCanvasFormula(f, r, tol, d, col, tbl.columns || []),
                          rowIndex: rIdx,
                        });

                        return (
                          <td
                            key={col.id}
                            className={`py-1.5 px-1 border ${
                              isScreen ? "border-border/70 text-foreground" : "border border-black text-black"
                            } leading-tight break-words whitespace-normal ${getTextAlignClass(col.align || 'center')}`}
                          >
                            {renderCellContent(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        {tbl.footerNote && (
          <div
            className={
              isScreen
                ? "p-2 text-xs italic text-center bg-muted/20 border-t border-border text-muted-foreground"
                : "p-1 text-[7.5px] italic text-center bg-slate-50 border-t border-black"
            }
          >
            {tbl.footerNote}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {blocks.map((block: any, idx: number) => {
        const mt = block.marginTop !== undefined ? Number(block.marginTop) : 0;
        const mb = block.marginBottom !== undefined ? Number(block.marginBottom) : (block.type === "page_break" ? 0 : 6);
        const blockSpacingStyle: React.CSSProperties = {
          marginTop: `${mt}px`,
          marginBottom: `${mb}px`,
        };
        if (block.type === "table_grid") {
          return (
            <div key={block.id || idx} style={blockSpacingStyle}>
              {renderSingleTableGrid(block, false)}
            </div>
          );
        }
        if (block.type === "split_row") {
          const numCols = block.children?.length || 2;
          return (
            <div
              key={block.id || idx}
              style={{
                ...blockSpacingStyle,
                display: "grid",
                gridTemplateColumns: isScreen ? undefined : `repeat(${numCols}, minmax(0, 1fr))`,
              }}
              className={`grid ${isScreen ? `grid-cols-1 md:grid-cols-${numCols} gap-3` : "gap-2"} items-start w-full`}
            >
              {block.children?.map((child: any, cIdx: number) => {
                const isBlank = !child || child.type === "blank" || child.type === "empty" || (child.type === "text_block" && !child.content?.trim());
                return (
                  <div key={child?.id || cIdx} className="min-w-0 w-full overflow-hidden">
                    {child?.type === "table_grid" && renderSingleTableGrid(child, true)}
                    {child?.type === "text_block" && child.content?.trim() && (
                      <div
                        className={
                          isScreen
                            ? "p-2.5 border border-border rounded-lg text-xs bg-muted/30 text-foreground text-center font-medium"
                            : "p-1.5 border border-black text-[8px] bg-slate-50 text-center font-medium"
                        }
                      >
                        {child.content}
                      </div>
                    )}
                    {(child?.type === "diagram_block" || child?.type === "diagram") && (child.imageUrl || child.image) && (
                      <div
                        className={`w-full border ${
                          isScreen ? "border-border rounded-lg bg-card p-2" : "border border-black bg-white p-1.5"
                        } flex ${
                          child.alignment === "left"
                            ? "justify-start"
                            : child.alignment === "right"
                            ? "justify-end"
                            : "justify-center"
                        } items-center`}
                      >
                        <img
                          src={child.imageUrl || child.image}
                          alt={child.caption || "Calibration Diagram"}
                          style={{
                            width: child.width ? `${child.width}px` : "240px",
                            maxWidth: "100%",
                            maxHeight: child.height ? `${child.height}px` : "140px",
                            objectFit: "contain",
                          }}
                          className="block rounded"
                        />
                      </div>
                    )}
                    {isBlank && <div className="w-full min-h-[20px]" />}
                  </div>
                );
              })}
            </div>
          );
        }
        if (block.type === "matrix_table") {
          const matrixBlock = normalizeMatrixTableGeometry(block as any);
          const totalCols = getMatrixTotalCols(matrixBlock);
          const { coveredCells: coveredHeaders } = computeMatrix2DGrid(matrixBlock.headers || [], totalCols);
          const { coveredCells: coveredRows } = computeMatrix2DGrid(matrixBlock.rows || [], totalCols);

          return (
            <div
              key={matrixBlock.id || idx}
              style={{
                ...blockSpacingStyle,
                width: matrixBlock.width === "50%" ? "50%" : "100%",
                marginLeft: matrixBlock.width === "50%" ? "auto" : undefined,
                marginRight: matrixBlock.width === "50%" ? "auto" : undefined,
              }}
              className={
                isScreen
                  ? "border border-border/80 rounded-lg overflow-hidden bg-card flex flex-col mb-3 shadow-xs"
                  : "border border-black flex flex-col bg-white overflow-hidden"
              }
            >
              {Boolean(matrixBlock.title && String(matrixBlock.title).trim() !== "") && (
                <div
                  className={
                    isScreen
                      ? "bg-muted/70 text-foreground text-xs font-semibold py-1.5 px-3 text-center uppercase tracking-wide border-b border-border"
                      : "bg-slate-200 text-black text-[9px] font-bold py-1 px-2 text-center uppercase tracking-wide border-b border-black"
                  }
                >
                  {String(matrixBlock.title).trim()}
                </div>
              )}
              <div
                className={isScreen ? "w-full overflow-x-auto" : "w-full overflow-hidden"}
                style={!isScreen ? { scrollbarWidth: "none", msOverflowStyle: "none" } : undefined}
              >
                <table
                  className={`w-full border-collapse text-center font-mono ${isScreen ? "text-xs" : "text-[7.5px]"}`}
                  style={{ tableLayout: "fixed" }}
                >
                  <thead>
                    {matrixBlock.headers?.map((hRow: any[], hIdx: number) => {
                      const cells = Array.isArray(hRow) ? hRow : [hRow];
                      let colPointer = 0;
                      return (
                        <tr key={hIdx} className={isScreen ? "bg-muted/40 font-semibold text-muted-foreground" : "bg-slate-100 font-bold"}>
                          {cells.map((rawCell: any, cIdx: number) => {
                            while (colPointer < totalCols && coveredHeaders.has(`${hIdx}_${colPointer}`)) {
                              colPointer++;
                            }
                            const actualCol = colPointer;
                            const cell = normalizeMatrixCell(rawCell);
                            colPointer += (cell.colSpan || 1);

                            if (actualCol >= totalCols || coveredHeaders.has(`${hIdx}_${actualCol}`)) {
                              return null;
                            }

                            return (
                              <th
                                key={cIdx}
                                colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                                rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                style={{ textAlign: cell.align || "center" }}
                                className={`py-1.5 px-1 border ${
                                  isScreen ? "border-border/70 text-foreground font-semibold" : "border border-black text-black font-bold"
                                } break-words whitespace-normal leading-tight`}
                              >
                                {cell.text}
                              </th>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </thead>
                  <tbody>
                    {(!matrixBlock.rows || matrixBlock.rows.length === 0) ? (
                      <tr>
                        <td
                          colSpan={totalCols}
                          className={`py-1.5 px-1 border ${
                            isScreen ? "border-border/70 text-muted-foreground italic text-center" : "border border-black text-black italic text-center"
                          } leading-snug`}
                        >
                          -
                        </td>
                      </tr>
                    ) : (
                      matrixBlock.rows.map((row: any[], rIdx: number) => {
                        const cells = Array.isArray(row) ? row : [row];
                        let colPointer = 0;
                        return (
                          <tr key={rIdx} className={isScreen ? "hover:bg-muted/20" : undefined}>
                            {cells.map((rawCell: any, cIdx: number) => {
                              while (colPointer < totalCols && coveredRows.has(`${rIdx}_${colPointer}`)) {
                                colPointer++;
                              }
                              const actualCol = colPointer;
                              const cell = normalizeMatrixCell(rawCell);
                              colPointer += (cell.colSpan || 1);

                              if (actualCol >= totalCols || coveredRows.has(`${rIdx}_${actualCol}`)) {
                                return null;
                              }

                              return (
                                <td
                                  key={cIdx}
                                  colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                                  rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                  style={{ textAlign: cell.align || "center" }}
                                  className={`py-1.5 px-1 border ${
                                    isScreen ? "border-border/70 text-foreground" : "border border-black text-black"
                                  } leading-tight break-words whitespace-normal`}
                                >
                                  {renderCellContent(cell.text)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {block.footerNote && (
                <div
                  className={
                    isScreen
                      ? "p-2 text-xs italic text-center bg-muted/20 border-t border-border text-muted-foreground"
                      : "text-[7.5px] italic text-slate-700 dark:text-slate-300 p-1 border-t border-black bg-slate-50 text-center"
                  }
                >
                  {block.footerNote}
                </div>
              )}
            </div>
          );
        }
        if (block.type === "text_block") {
          return (
            <div
              key={block.id || idx}
              style={blockSpacingStyle}
              className={
                isScreen
                  ? "p-2.5 border border-border rounded-lg text-xs bg-muted/30 text-foreground text-center font-medium"
                  : "p-1 border border-black text-[8px] bg-slate-50 text-center font-medium"
              }
            >
              {block.content}
            </div>
          );
        }
        if (block.type === "diagram_block" || block.type === "diagram") {
          const dImg = block.imageUrl || block.image;
          if (!dImg) return null;
          return (
            <div
              key={block.id || idx}
              style={blockSpacingStyle}
              className={`w-full border ${
                isScreen ? "border-border rounded-lg bg-card p-2" : "border border-black bg-white p-1.5"
              } flex ${
                block.alignment === "left"
                  ? "justify-start"
                  : block.alignment === "right"
                  ? "justify-end"
                  : "justify-center"
              } items-center`}
            >
              <img
                src={dImg}
                alt={block.caption || "Calibration Diagram"}
                crossOrigin="anonymous"
                style={{
                  width: block.width ? `${block.width}px` : "240px",
                  maxWidth: "100%",
                  maxHeight: block.height ? `${block.height}px` : "140px",
                  objectFit: "contain",
                }}
                className="block rounded"
                onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  imgEl.style.display = "none";
                  imgEl.setAttribute("data-img-error", "true");
                }}
              />
            </div>
          );
        }
        if (block.type === "page_break") {
          return (
            <div
              key={block.id || idx}
              style={blockSpacingStyle}
              className={`border-t border-dashed ${
                isScreen ? "border-border my-2 pt-1 text-[10px]" : "border-slate-400 my-1 pt-0.5 text-[7px]"
              } text-center text-muted-foreground print:break-before-page`}
            >
              --- PAGE BREAK ---
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

interface CertificatePreviewProps {
  calibration: Partial<CalibrationRecord>;
  instrumentName?: string;
  showDownloadPng?: boolean;
  isTemplatePreview?: boolean;
}

/**
 * Live HTML preview matching standard NABL calibration certificate layout.
 * Formatted according to calibration-certificate-01-3487339.jpg layout.
 */
export function CertificatePreview({
  calibration,
  instrumentName,
  showDownloadPng = true,
  isTemplatePreview = false,
}: CertificatePreviewProps) {
  const { user } = useAuth();
  const [certConfig, setCertConfig] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const isPreviewMode =
    Boolean(isTemplatePreview) ||
    Boolean((calibration as any)?.is_template_preview) ||
    Boolean((calibration as any)?.is_preview) ||
    calibration.certificate_number === "PREVIEW-DEMO-001" ||
    (typeof calibration.certificate_number === "string" && calibration.certificate_number.startsWith("PREVIEW-"));

  useEffect(() => {
    const fetchSignatories = async () => {
      try {
        const res = await httpClient.get(`/calibrations/signatories${user?.companyId ? `?companyId=${user.companyId}` : ""}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setUsersList(res.data);
          return;
        }
      } catch {}

      if (user?.companyId) {
        httpClient
          .get(`/users?companyId=${user.companyId}`)
          .then((res) => {
            if (Array.isArray(res.data)) setUsersList(res.data);
          })
          .catch(() => {});
      }
    };

    fetchSignatories();
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

  const getCompanyLogoUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
      return path;
    }
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || API_URL || "").replace(/\/api\/?$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
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
  const docDate =
    calibration.doc_date ||
    (calibration as any).docDate ||
    ((calibration as any).template as any)?.doc_date ||
    ((calibration as any).template as any)?.docDate;
  const docRev =
    calibration.doc_rev ||
    (calibration as any).docRev ||
    ((calibration as any).template as any)?.doc_rev ||
    ((calibration as any).template as any)?.docRev;

  const procedureNo =
    calibration.procedure_no ||
    (calibration as any).procedureNo ||
    ((calibration as any).template as any)?.procedure_no ||
    ((calibration as any).template as any)?.procedureNo ||
    calibration.procedure_reference ||
    (calibration as any).procedureReference ||
    ((calibration as any).template as any)?.procedure_reference;
  const procedureName =
    calibration.procedure_name ||
    (calibration as any).procedureName ||
    ((calibration as any).template as any)?.procedure_name;
  const procedureDate =
    calibration.procedure_date ||
    (calibration as any).procedureDate ||
    ((calibration as any).template as any)?.procedure_date;
  const procedureRev =
    calibration.procedure_rev ||
    (calibration as any).procedureRev ||
    ((calibration as any).template as any)?.procedure_rev;

  const acceptanceCriteriaDocNo =
    calibration.acceptance_criteria_doc_no ||
    (calibration as any).acceptanceCriteriaDocNo ||
    ((calibration as any).template as any)?.acceptance_criteria_doc_no;
  const acceptanceCriteriaDate =
    calibration.acceptance_criteria_date ||
    (calibration as any).acceptanceCriteriaDate ||
    ((calibration as any).template as any)?.acceptance_criteria_date;
  const acceptanceCriteriaRev =
    calibration.acceptance_criteria_rev ||
    (calibration as any).acceptanceCriteriaRev ||
    ((calibration as any).template as any)?.acceptance_criteria_rev;
  const acceptanceCriteriaReference =
    calibration.acceptance_criteria_reference ||
    (calibration as any).acceptanceCriteriaReference ||
    ((calibration as any).template as any)?.acceptance_criteria_reference;

  let acceptanceCriteriaText = "";
  if (acceptanceCriteriaReference) {
    acceptanceCriteriaText = acceptanceCriteriaReference;
  } else if (acceptanceCriteriaDocNo) {
    const revPart = acceptanceCriteriaRev
      ? ` Rev-${acceptanceCriteriaRev.replace(/^rev-?/i, "")}`
      : "";
    const datePart = acceptanceCriteriaDate ? ` dated ${acceptanceCriteriaDate}` : "";
    acceptanceCriteriaText = `AS Per ${acceptanceCriteriaDocNo}${revPart}${datePart}`;
  }

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

  const companyLogoPath = certConfig?.companyLogoPath || "";

  useEffect(() => {
    setLogoError(false);
  }, [companyLogoPath]);
  const headerDisplayMode = certConfig?.headerDisplayMode || "name";
  const headerBgColor = certConfig?.headerBgColor || "#54c6f3";

  const layoutBlocks =
    (calibration as any).layout_blocks ||
    ((calibration as any).template as any)?.layout_blocks;

  // Helper to render Calibration Results
  const renderCalibrationResult = () => {
    if (layoutBlocks && layoutBlocks.length > 0) {
      return <CanvasBlocksRenderer blocks={layoutBlocks} />;
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
      certElement.classList.add("exporting-cert-png");
      await new Promise((resolve) => setTimeout(resolve, 80));

      const targetWidth = 794;
      const targetHeight = Math.ceil(Math.max(certElement.scrollHeight, certElement.offsetHeight)) + 4;

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
          height: "auto",
          minHeight: `${targetHeight}px`,
          margin: "0",
          padding: "0",
          left: "0",
          top: "0",
          position: "static",
          transform: "none",
          boxShadow: "none",
          borderRadius: "0",
          border: "none",
          overflow: "visible",
        },
        backgroundColor: "#ffffff",
        cacheBust: false,
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        filter: (domNode) => {
          if (domNode instanceof HTMLImageElement) {
            // Exclude broken, errored, hidden, or unrendered images from being cloned
            if (
              domNode.style.display === "none" ||
              domNode.getAttribute("data-img-error") === "true" ||
              (domNode.complete && domNode.naturalWidth === 0) ||
              !domNode.getAttribute("src")
            ) {
              return false;
            }
          }
          return true;
        },
      });

      saveAs(dataUrl, `Certificate-${certNum}.png`);
      toast.success("High quality PNG certificate downloaded successfully!");
    } catch (err) {
      console.error("Failed to export certificate image", err);
      toast.error("Failed to generate PNG certificate image");
    } finally {
      if (certRef.current) {
        certRef.current.classList.remove("exporting-cert-png");
      }
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
        className="relative bg-white text-black border border-slate-300 rounded-sm shadow-xl text-[10px] leading-normal font-sans flex flex-col w-[794px] min-w-[794px] max-w-[794px] shrink-0 min-h-[1123px] overflow-visible print:min-h-[100vh] print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:m-0"
      >
        {/* CSS rules for zero scrollbars & clean export */}
        <style>{`
          .exporting-cert-png,
          .exporting-cert-png * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .exporting-cert-png *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          .exporting-cert-png div[class*="overflow-x-auto"],
          .exporting-cert-png div[class*="overflow-auto"],
          .exporting-cert-png div[class*="overflow-hidden"] {
            overflow: visible !important;
          }
        `}</style>
        {/* Dynamic Watermark for Unapproved Draft / Pending Approvals / Template Preview */}
        {calibration.approval_status !== "Approved" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden z-20">
            <span className="text-red-500/12 text-4xl font-black uppercase tracking-widest -rotate-45 text-center leading-relaxed max-w-lg border-4 border-red-500/15 py-3 px-6 rounded-xl">
              {isPreviewMode
                ? "TEMPLATE PREVIEW"
                : calibration.approval_status === "Reviewed" || calibration.approval_status === "Pending Approval"
                ? "REVIEWED - PENDING FINAL APPROVAL"
                : "DRAFT - PENDING REVIEW"}
            </span>
          </div>
        )}
      {/* ── 1. HEADER SECTION (Full Width Edge-to-Edge Banner) ── */}
      <div
        className="p-2.5 text-black w-full"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 max-w-[200px]">
            {companyLogoPath && !logoError &&
              (headerDisplayMode === "logo" ||
                headerDisplayMode === "both") && (
                <img
                  src={getCompanyLogoUrl(companyLogoPath)}
                  alt="Logo"
                  crossOrigin="anonymous"
                  className="max-h-12 w-auto object-contain"
                  onError={(e) => {
                    const imgEl = e.currentTarget as HTMLImageElement;
                    imgEl.style.display = "none";
                    imgEl.setAttribute("data-img-error", "true");
                    setLogoError(true);
                  }}
                />
              )}
            {(headerDisplayMode === "name" ||
              headerDisplayMode === "both" ||
              !companyLogoPath ||
              logoError) && (
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
          <div className="shrink-0 min-w-[140px] flex justify-end">
            {docNo ? (
              <div className="text-right text-black min-w-[140px]">
                <div className="text-[8px] font-bold tracking-tight whitespace-nowrap">
                  Doc.No : <span className="font-extrabold">{docNo}</span>
                </div>
                <div className="text-[8px] font-bold tracking-tight whitespace-nowrap">
                  Date &amp; Rev : <span className="font-semibold">{docDate || "-"} &amp; {docRev || "-"}</span>
                </div>
              </div>
            ) : (
              <div className="text-right text-black min-w-[120px]">
                <div className="text-[7.5px] font-bold tracking-tight whitespace-nowrap">{headerRightBoxText1}</div>
                <div className="text-[9px] font-black tracking-tight whitespace-nowrap">{headerRightBoxText2}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. BODY CONTENT SECTION ── */}
      <div className="p-2.5 flex flex-col flex-1">
        <div
          className={`border border-black flex flex-col flex-1 ${isCompact ? "p-1.5 text-[8.5px]" : "p-2 text-[9.5px]"}`}
          style={{ gap: `${Math.max(2, (Number(certConfig?.tableGap) || 2.5) * 1.33)}px` }}
        >
          {/* Top Certificate Metadata Grid */}
          <table className={`w-full border-collapse border border-black ${isCompact ? "text-[8px]" : "text-[9px]"}`}>
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Calibration Location</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Calibration On</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Next Calibration Due</th>
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Certificate No.:</th>
                {calibration.ulr_number && (
                  <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>ULR No.</th>
                )}
                <th className={`border-r border-black ${isCompact ? "p-0.5" : "p-1"}`}>Certi Issue Date</th>
                <th className={isCompact ? "p-0.5" : "p-1"}>Sheet No.</th>
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
                <td className={isCompact ? "p-0.5" : "p-1"}>{sheetNoText}</td>
              </tr>
            </tbody>
          </table>

          {/* Description & Identification (4 Columns / 2 Rows) */}
          <div className="border border-black">
            <div className={`bg-slate-200 text-black ${isCompact ? "text-[8.5px] py-0.5 px-1.5" : "text-[10px] py-0.5 px-2"} font-bold border-b border-black text-center uppercase`}>
              Description & Identification
            </div>
            <table className={`w-full border-collapse ${isCompact ? "text-[7.5px]" : "text-[8.5px]"}`} style={{ tableLayout: "fixed" }}>
              <tbody>
                {/* Row 1: Instrument (DUC) | Make | Range | Serial No */}
                <tr className="border-b border-black">
                  <td className="w-[26%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Instrument (DUC)</div>
                    <div className="font-bold truncate">{instrumentName || inst?.name || "-"}</div>
                  </td>
                  <td className="w-[30%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Make</div>
                    <div className="font-bold truncate">{inst?.make || "-"}</div>
                  </td>
                  <td className="w-[23%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">{rangeLabel}</div>
                    <div className="font-bold truncate">{inst?.range || "-"}</div>
                  </td>
                  <td className="w-[21%] p-1 overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Serial No.</div>
                    <div className="font-bold truncate">{inst?.serial_no || "-"}</div>
                  </td>
                </tr>
                {/* Row 2: Least Count | ID No | Instrument Cond | Location */}
                <tr>
                  <td className="w-[26%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Least Count</div>
                    <div className="font-bold truncate">{inst?.least_count || "-"}</div>
                  </td>
                  <td className="w-[30%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">ID No.</div>
                    <div className="font-bold truncate">{inst?.id_code || "-"}</div>
                  </td>
                  <td className="w-[23%] p-1 border-r border-black overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Instrument Cond.</div>
                    <div className="font-bold truncate">SATISFACTORY</div>
                  </td>
                  <td className="w-[21%] p-1 overflow-hidden">
                    <div className="font-bold text-slate-600 text-[8px]">Location</div>
                    <div className="font-bold truncate">{inst?.location || "Permanent Laboratory"}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Procedure & Environmental Conditions Table */}
          <table className={`w-full border-collapse border border-black ${isCompact ? "text-[7.5px]" : "text-[8.5px]"}`} style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-slate-100 border-b border-black font-bold text-left">
                <th className={`w-[26%] border-r border-black whitespace-nowrap overflow-hidden ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Procedure No, Name &amp; Rev/Date</th>
                <th className={`w-[30%] border-r border-black whitespace-nowrap overflow-hidden ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Acceptance Criteria Doc.No &amp; Rev-Date</th>
                <th className={`w-[23%] border-r border-black ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Standard Reference</th>
                <th className={`w-[21%] ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>Discipline</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className={`border-r border-black ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  <div className="font-bold text-black leading-tight text-[8px] mb-0.5">
                    {procedureName || "-"}
                  </div>
                  {procedureNo && (
                    <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight text-[7.5px] mt-0.5">
                      Proc No: {procedureNo}
                    </div>
                  )}
                  {(procedureRev || procedureDate) && (
                    <div className="text-slate-600 font-medium leading-tight text-[7px] mt-0.5">
                      {[procedureRev ? `Rev-${procedureRev.replace(/^rev-?/i, "")}` : "", procedureDate ? `dated ${procedureDate}` : ""].filter(Boolean).join(" ")}
                    </div>
                  )}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  {acceptanceCriteriaDocNo || acceptanceCriteriaReference ? (
                    <>
                      <div className="font-semibold leading-tight text-[7.5px]">
                        Doc.No.: {acceptanceCriteriaDocNo || acceptanceCriteriaReference}
                      </div>
                      {(acceptanceCriteriaRev || acceptanceCriteriaDate) && (
                        <div className="text-slate-600 font-medium leading-tight text-[7px] mt-0.5">
                          {[acceptanceCriteriaRev ? `Rev-${acceptanceCriteriaRev.replace(/^rev-?/i, "")}` : "", acceptanceCriteriaDate ? `dated ${acceptanceCriteriaDate}` : ""].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-slate-600 font-medium leading-tight text-[7.5px]">
                      {acceptanceCriteriaText || "-"}
                    </div>
                  )}
                </td>
                <td className={`border-r border-black ${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  {(calibration as any).standard_reference || calibration.remarks || "Standard calibration per ISO/IEC 17025"}
                </td>
                <td className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"}`}>
                  {(calibration as any).discipline || "DIMENSION (Basic Measuring Instrument, Gauge etc)"}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className={`${isCompact ? "p-0.5 px-1.5" : "p-1 px-1.5"} font-medium`}>
                  <span className="font-bold">Environmental Conditions</span> : Temperature at {env.temperature || "-"}° C RH {env.humidity || "-"} %
                  {Boolean(env.soaking_time || env.soaking_start_time || env.soaking_end_time) && (
                    <span className="ml-3">
                      | <span className="font-bold">Soaking Details:</span> {env.soaking_start_time && `Start: ${env.soaking_start_time} `}
                      {env.soaking_end_time && `| End: ${env.soaking_end_time} `}
                      {env.soaking_time && `| Soaking Time: ${env.soaking_time}`}
                    </span>
                  )}
                  {Boolean((env as any).receipt_condition || (calibration as any).receipt_condition) && (
                    <span className="ml-3">
                      | <span className="font-bold">Receipt Condition:</span> {String((env as any).receipt_condition || (calibration as any).receipt_condition)}
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
                <th colSpan={6} className={`bg-slate-200 text-black ${isCompact ? "text-[8.5px] py-0.5 px-1.5" : "text-[10px] py-0.5 px-2"} font-bold text-center border-b border-black`}>
                  TRACEABILITY OF MASTER USED
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
                        {(ref.agency && ref.agency.trim()) ? ref.agency.trim() : "-"}
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
                    {((calibration as any)?.reference_standard_agency && (calibration as any).reference_standard_agency.trim()) ? (calibration as any).reference_standard_agency.trim() : "-"}
                  </td>
                </tr>
              )}

            </tbody>
          </table>

          {/* Optional Diagram / Schematic Image */}
          {(() => {
            let diagramImage: string | null = null;
            if (calibration.diagram_image && typeof calibration.diagram_image === "string" && calibration.diagram_image.trim()) {
              diagramImage = calibration.diagram_image;
            } else if ((calibration.instrument as any)?.custom_parameters?.diagram_image && typeof (calibration.instrument as any).custom_parameters.diagram_image === "string" && (calibration.instrument as any).custom_parameters.diagram_image.trim()) {
              diagramImage = (calibration.instrument as any).custom_parameters.diagram_image;
            } else if (((calibration as any).template as any)?.diagram_image && typeof ((calibration as any).template as any).diagram_image === "string" && ((calibration as any).template as any).diagram_image.trim()) {
              diagramImage = ((calibration as any).template as any).diagram_image;
            }
            if (!diagramImage || (typeof diagramImage === "string" && !diagramImage.trim())) return null;

            const diagramWidth =
              calibration.diagram_image_width ||
              ((calibration as any).template as any)?.diagram_image_width ||
              (calibration.instrument as any)?.custom_parameters?.diagram_image_width ||
              300;
            const diagramHeight =
              calibration.diagram_image_height ||
              ((calibration as any).template as any)?.diagram_image_height ||
              (calibration.instrument as any)?.custom_parameters?.diagram_image_height ||
              140;
            const diagramAlignment =
              calibration.diagram_image_alignment ||
              ((calibration as any).template as any)?.diagram_image_alignment ||
              (calibration.instrument as any)?.custom_parameters?.diagram_image_alignment ||
              "center";

            return (
              <div
                className={`w-full border border-black bg-white p-1.5 flex ${
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
                  crossOrigin="anonymous"
                  style={{
                    width: `${diagramWidth}px`,
                    maxWidth: "100%",
                    maxHeight: `${diagramHeight}px`,
                    objectFit: "contain",
                  }}
                  className="block"
                  onError={(e) => {
                    const imgEl = e.currentTarget as HTMLImageElement;
                    imgEl.style.display = "none";
                    imgEl.setAttribute("data-img-error", "true");
                  }}
                />
              </div>
            );
          })()}

          {/* Calibration Result */}
          {renderCalibrationResult()}

          {/* Remarks Section */}
          {Boolean(calibration.remarks && typeof calibration.remarks === "string" && calibration.remarks.trim()) && (
            <div
              className={`border border-black bg-white ${
                isCompact ? "p-1 px-1.5 mb-1 text-[7.5px]" : "p-1.5 px-2 mb-1.5 text-[8.5px]"
              } leading-normal text-left`}
            >
              <span className="font-bold text-black uppercase tracking-wider block text-[7.5px] mb-0.5">
                Remarks / Notes:
              </span>
              <div className="font-medium text-black whitespace-pre-line leading-relaxed font-sans">
                {calibration.remarks.trim()}
              </div>
            </div>
          )}

          {/* Signature & Authentication Block (3 Columns: Calibrated By | Reviewed By | Approved By) */}
          {(() => {
            const isImgUrl = (str?: string) =>
              !!str && (str.startsWith("data:image") || str.startsWith("http") || str.startsWith("/"));

            const isApproved =
              !isPreviewMode &&
              (calibration.approval_status === "Approved" ||
                (calibration as any).approval_status === "APPROVED" ||
                Boolean((calibration as any).approved_at)) &&
              Boolean(calibration.approved_by && calibration.approved_by.trim() !== "" && calibration.approved_by !== "Pending Approval");

            const isReviewed =
              !isPreviewMode &&
              Boolean(calibration.reviewed_by && calibration.reviewed_by.trim() !== "" && calibration.reviewed_by !== "Pending Review") &&
              (calibration.approval_status === "Reviewed" ||
                calibration.approval_status === "Approved" ||
                (calibration as any).approval_status === "APPROVED" ||
                Boolean((calibration as any).reviewed_at) ||
                Boolean((calibration as any).reviewed_by_signature));

            const rawCalibratedSig = !isPreviewMode ? (calibration as any).calibrated_by_signature : null;
            const calibratedSigImg = isPreviewMode
              ? null
              : isImgUrl(rawCalibratedSig)
              ? rawCalibratedSig
              : ((user?.name === calibration.calibrated_by || user?.id === calibration.calibrated_by) && isImgUrl((user as any)?.signature))
              ? (user as any).signature
              : usersList.find(
                  (u) =>
                    (u.name === calibration.calibrated_by || u.id === calibration.calibrated_by) &&
                    isImgUrl(u.signature),
                )?.signature || null;

            const rawReviewedSig = isReviewed ? (calibration as any).reviewed_by_signature : null;
            const reviewedSigImg = isReviewed
              ? (isImgUrl(rawReviewedSig)
                  ? rawReviewedSig
                  : ((user?.name === calibration.reviewed_by || user?.id === (calibration as any).reviewed_by_id) && isImgUrl((user as any)?.signature))
                  ? (user as any).signature
                  : usersList.find(
                      (u) =>
                        (u.name === calibration.reviewed_by ||
                          u.id === calibration.reviewed_by ||
                          u.id === (calibration as any).reviewed_by_id) &&
                        isImgUrl(u.signature),
                    )?.signature || null)
              : null;

            const rawApprovedSig = isApproved ? (calibration as any).approved_by_signature : null;
            const approvedSigImg = isApproved
              ? (isImgUrl(rawApprovedSig)
                  ? rawApprovedSig
                  : ((user?.name === calibration.approved_by || user?.id === (calibration as any).approved_by_id) && isImgUrl((user as any)?.signature))
                  ? (user as any).signature
                  : usersList.find(
                      (u) =>
                        (u.name === calibration.approved_by ||
                          u.id === calibration.approved_by ||
                          u.id === (calibration as any).approved_by_id) &&
                        isImgUrl(u.signature),
                    )?.signature || null)
              : null;

            const sigWidth = Number(certConfig?.signatureImageWidth) || 75;
            const sigHeight = Number(certConfig?.signatureImageHeight) || 28;

            return (
              <div className={`border border-black ${isCompact ? "p-1.5 mt-auto" : "p-2 mt-auto"} grid grid-cols-3 gap-2 items-end`}>
                {/* Column 1: Calibrated By */}
                <div className="text-center space-y-0.5">
                  <div
                    className="flex items-end justify-center"
                    style={{ minHeight: `${sigHeight * 1.33}px` }}
                  >
                    {!isPreviewMode && calibratedSigImg ? (
                      <img
                        src={calibratedSigImg}
                        alt="Signature"
                        crossOrigin="anonymous"
                        style={{
                          maxHeight: `${sigHeight * 1.33}px`,
                          maxWidth: `${sigWidth * 1.33}px`,
                        }}
                        className="object-contain mx-auto"
                        onError={(e) => {
                          const imgEl = e.currentTarget as HTMLImageElement;
                          imgEl.style.display = "none";
                          imgEl.setAttribute("data-img-error", "true");
                        }}
                      />
                    ) : !isPreviewMode && calibration.calibrated_by ? (
                      <span className={`font-cursive italic text-slate-700 ${isCompact ? "text-[10px]" : "text-xs"}`}>
                        {calibration.calibrated_by}
                      </span>
                    ) : null}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className={`font-bold ${isCompact ? "text-[8px]" : "text-[9.5px]"}`}>
                      {isPreviewMode ? "Calibrated By" : (calibration.calibrated_by || "Calibrated By")}
                    </p>
                    <p className={`${isCompact ? "text-[7.5px]" : "text-[8.5px]"} text-slate-600`}>
                      {calibration.calibrated_by_designation ||
                        "Calibration Engineer"}
                    </p>
                  </div>
                </div>

                {/* Column 2: Reviewed By */}
                <div className="text-center space-y-0.5">
                  <div
                    className="flex items-end justify-center"
                    style={{ minHeight: `${sigHeight * 1.33}px` }}
                  >
                    {!isPreviewMode && isReviewed && reviewedSigImg ? (
                      <img
                        src={reviewedSigImg}
                        alt="Signature"
                        crossOrigin="anonymous"
                        style={{
                          maxHeight: `${sigHeight * 1.33}px`,
                          maxWidth: `${sigWidth * 1.33}px`,
                        }}
                        className="object-contain mx-auto"
                        onError={(e) => {
                          const imgEl = e.currentTarget as HTMLImageElement;
                          imgEl.style.display = "none";
                          imgEl.setAttribute("data-img-error", "true");
                        }}
                      />
                    ) : !isPreviewMode && isReviewed && calibration.reviewed_by ? (
                      <span className={`font-cursive italic text-slate-700 ${isCompact ? "text-[10px]" : "text-xs"}`}>
                        {calibration.reviewed_by}
                      </span>
                    ) : null}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className={`font-bold ${isCompact ? "text-[8px]" : "text-[9.5px]"}`}>
                      {isPreviewMode ? "Reviewed By" : (isReviewed ? (calibration.reviewed_by || "Reviewed By") : "Reviewed By")}
                    </p>
                    <p className={`${isCompact ? "text-[7.5px]" : "text-[8.5px]"} text-slate-600`}>
                      {calibration.reviewed_by_designation ||
                        "Quality Head"}
                    </p>
                  </div>
                </div>

                {/* Column 3: Approved By */}
                <div className="text-center space-y-0.5">
                  <div
                    className="flex items-end justify-center"
                    style={{ minHeight: `${sigHeight * 1.33}px` }}
                  >
                    {!isPreviewMode && isApproved && approvedSigImg ? (
                      <img
                        src={approvedSigImg}
                        alt="Signature"
                        crossOrigin="anonymous"
                        style={{
                          maxHeight: `${sigHeight * 1.33}px`,
                          maxWidth: `${sigWidth * 1.33}px`,
                        }}
                        className="object-contain mx-auto"
                        onError={(e) => {
                          const imgEl = e.currentTarget as HTMLImageElement;
                          imgEl.style.display = "none";
                          imgEl.setAttribute("data-img-error", "true");
                        }}
                      />
                    ) : !isPreviewMode && isApproved && calibration.approved_by ? (
                      <span className={`font-cursive italic text-slate-700 ${isCompact ? "text-[10px]" : "text-xs"}`}>
                        {calibration.approved_by}
                      </span>
                    ) : null}
                  </div>
                  <div className="border-t border-black pt-0.5">
                    <p className={`font-bold ${isCompact ? "text-[8px]" : "text-[9.5px]"}`}>
                      {isPreviewMode ? "Approved By" : (isApproved ? (calibration.approved_by || "Approved By") : "Approved By")}
                    </p>
                    <p className={`${isCompact ? "text-[7.5px]" : "text-[8.5px]"} text-slate-600`}>
                      {calibration.approved_by_designation ||
                        "Technical Director"}
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
