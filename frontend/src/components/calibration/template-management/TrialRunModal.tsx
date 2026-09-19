import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FlaskConical,
  FileCheck2,
  Table,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sliders,
  Check,
  FileText,
} from "lucide-react";
import { CanvasBlock, TableGridBlock, SplitRowBlock, MatrixTableBlock, TextBlock, DiagramBlock } from "@/types/template";
import { CalibrationRecord } from "@/types/calibration";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { getEffectiveTableOrientation } from "@/lib/tableLayoutOptimizer";
import { evaluateCanvasRowFormulas, buildRowContext } from "@/lib/formulaEngine";
import { toast } from "sonner";

interface TrialRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: CanvasBlock[];
  templateName?: string;
  diagramImage?: string | null;
  diagramImageWidth?: number;
  diagramImageHeight?: number;
  diagramImageAlignment?: "center" | "left" | "right";
  defaultUnit?: string;
  defaultTolerance?: number;
  decimalPlaces?: number;
  docNo?: string;
  docDate?: string;
  docRev?: string;
  procedureReference?: string;
  procedureNo?: string;
  procedureName?: string;
  procedureDate?: string;
  procedureRev?: string;
  acceptanceCriteriaDocNo?: string;
  acceptanceCriteriaDate?: string;
  acceptanceCriteriaRev?: string;
  acceptanceCriteriaReference?: string;
}

export function TrialRunModal({
  open,
  onOpenChange,
  blocks,
  templateName = "Calibration Template",
  diagramImage,
  diagramImageWidth,
  diagramImageHeight,
  diagramImageAlignment,
  defaultUnit = "mm",
  defaultTolerance = 0.02,
  decimalPlaces = 3,
  docNo,
  docDate,
  docRev,
  procedureReference,
  procedureNo,
  procedureName,
  procedureDate,
  procedureRev,
  acceptanceCriteriaDocNo,
  acceptanceCriteriaDate,
  acceptanceCriteriaRev,
  acceptanceCriteriaReference,
}: TrialRunModalProps) {
  const [activeTab, setActiveTab] = useState<"test" | "certificate">("test");
  const [testBlocks, setTestBlocks] = useState<CanvasBlock[]>([]);

  // Prepare table rows for trial run (evaluating structured bounds with blank or existing readings)
  const prefillTableRows = (tbl: TableGridBlock) => {
    if (!tbl.rows || !tbl.columns) return;
    const dec = tbl.decimal_places ?? decimalPlaces ?? 3;
    const tol = parseFloat(String(tbl.tolerance ?? defaultTolerance)) || 0.02;

    tbl.rows = tbl.rows.map((r: any) => {
      // Evaluate row formulas (Avg, Error, Judgement) with deterministic metrology engine
      return evaluateCanvasRowFormulas(r, tbl.columns, tol, dec);
    });
  };

  // Deep clone blocks when modal opens
  useEffect(() => {
    if (open) {
      const cloned = JSON.parse(JSON.stringify(blocks));
      cloned.forEach((block: any) => {
        if (block.type === "table_grid" && block.rows) {
          prefillTableRows(block);
        }
        if (block.type === "split_row" && block.children) {
          block.children.forEach((child: any) => {
            if (child.type === "table_grid" && child.rows) {
              prefillTableRows(child);
            }
          });
        }
      });
      setTestBlocks(cloned);
    }
  }, [open, blocks, decimalPlaces]);

  // Recalculate row formulas in real time
  const handleCellChange = (
    blockIndex: number,
    rowIndex: number,
    colId: string,
    val: string,
    childIndex?: number
  ) => {
    const updated = JSON.parse(JSON.stringify(testBlocks));
    let targetTbl: TableGridBlock;

    if (childIndex !== undefined) {
      const split = updated[blockIndex] as SplitRowBlock;
      targetTbl = split.children[childIndex] as TableGridBlock;
    } else {
      targetTbl = updated[blockIndex] as TableGridBlock;
    }

    if (!targetTbl || !targetTbl.rows) return;

    const row = { ...targetTbl.rows[rowIndex], [colId]: val };
    const tol = parseFloat(String(row.tolerance ?? targetTbl.tolerance ?? defaultTolerance)) || 0.02;
    const dec = targetTbl.decimal_places !== undefined ? targetTbl.decimal_places : (decimalPlaces || 3);

    // Multi-pass formula evaluation: Pass 1 (Average) -> Pass 2 (Error) -> Pass 3 (Status)
    const evaluatedRow = evaluateCanvasRowFormulas(row, targetTbl.columns, tol, dec);

    targetTbl.rows[rowIndex] = evaluatedRow;
    setTestBlocks(updated);
  };

  // Quick fill sample data across all trials
  const handleQuickFill = (type: "pass" | "fail") => {
    const updated = JSON.parse(JSON.stringify(testBlocks));
    updated.forEach((block: any) => {
      const applyToTable = (tbl: TableGridBlock) => {
        if (!tbl || !tbl.rows || !tbl.columns) return;
        const dec = tbl.decimal_places ?? decimalPlaces ?? 3;
        const tol = parseFloat(String(tbl.tolerance ?? defaultTolerance)) || 0.02;

        tbl.rows = tbl.rows.map((r: any) => {
          const ctx = buildRowContext(r, tbl.columns, tol, dec);
          let readVal: number;
          if (type === "pass") {
            // Midpoint of tolerance limits guarantees PASS across symmetric, asymmetric, and negative-only tolerances
            readVal = parseFloat(((ctx.lowerLimit + ctx.upperLimit) / 2).toFixed(dec));
          } else {
            // Distinctly out-of-tolerance value beyond upper boundary
            const span = Math.abs(ctx.upperLimit - ctx.lowerLimit) || (tol * 2);
            readVal = parseFloat((ctx.upperLimit + span * 0.75 + 0.001).toFixed(dec));
          }
          const readStr = readVal.toFixed(dec);

          const updatedRow = { ...r };

          // Populate all trial and reading columns
          tbl.columns.forEach((c) => {
            const cId = (c.id || "").toLowerCase();
            const cLbl = (c.label || "").toLowerCase();
            if (c.type === "trial" || /^t[1-9]$/i.test(c.id) || /^[1-9]$/.test(c.id) || /^col_[1-9]$/i.test(c.id)) {
              updatedRow[c.id] = readStr;
            }
            if (
              c.type === "reading" ||
              c.role === "READING" ||
              c.role === "MEASUREMENT" ||
              cId === "reading" ||
              cId === "actual" ||
              cId === "actual_dimension" ||
              cId === "observation" ||
              cLbl.includes("actual") ||
              cLbl.includes("reading") ||
              cLbl.includes("observed")
            ) {
              updatedRow[c.id] = readStr;
            }
          });

          updatedRow.actual_dimension = readStr;
          updatedRow.actual = readStr;
          updatedRow.reading = readStr;
          updatedRow.t1 = readStr;
          updatedRow.t2 = readStr;
          updatedRow.t3 = readStr;
          updatedRow.t4 = readStr;
          updatedRow.t5 = readStr;

          // Re-evaluate with new readings
          return evaluateCanvasRowFormulas(updatedRow, tbl.columns, tol, dec);
        });
      };

      if (block.type === "table_grid") {
        applyToTable(block);
      }
      if (block.type === "split_row" && block.children) {
        block.children.forEach((child: any) => {
          if (child.type === "table_grid") {
            applyToTable(child);
          }
        });
      }
    });
    setTestBlocks(updated);
    toast.success(`Populated sample ${type.toUpperCase()} test readings across all trial columns!`);
  };


  // Calculate pass/fail summary
  let totalPoints = 0;
  let passPoints = 0;
  let failPoints = 0;

  testBlocks.forEach((b: any) => {
    if (b.type === "table_grid" && b.rows) {
      b.rows.forEach((r: any) => {
        totalPoints++;
        const st = String(r.status ?? r.judgement ?? r.judgment ?? "");
        if (st === "PASS") passPoints++;
        if (st === "FAIL") failPoints++;
      });
    }
  });

  // Extract any diagram image from template props or canvas blocks
  const diagramBlock = testBlocks.find((b) => b.type === "diagram_block" || (b as any).type === "diagram") as DiagramBlock | undefined;
  const activeDiagramImage = diagramImage || diagramBlock?.imageUrl || (blocks.find((b: any) => b.type === "diagram_block" || b.type === "diagram") as any)?.imageUrl;
  const activeDiagramWidth = diagramImageWidth || diagramBlock?.width || 320;
  const activeDiagramHeight = diagramImageHeight || diagramBlock?.height || 160;
  const activeDiagramAlign = diagramImageAlignment || diagramBlock?.alignment || "center";

  // Construct Mock Calibration Record for standard CertificatePreview rendering
  const mockCalibrationRecord: Partial<CalibrationRecord> = {
    id: "TRIAL-RUN-DEMO",
    certificate_number: `CC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    ulr_number: `ULR-TC8492${new Date().getFullYear().toString().slice(-2)}0000001F`,
    ulr_enabled: true,
    doc_no: docNo || undefined,
    doc_date: docDate || undefined,
    doc_rev: docRev || undefined,
    calibration_date: new Date().toISOString(),
    next_calibration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    certificate_issue_date: new Date().toISOString(),
    calibration_type: templateName,
    is_canvas_template: true,
    layout_blocks: testBlocks,
    diagram_image: activeDiagramImage || undefined,
    diagram_image_width: activeDiagramWidth,
    diagram_image_height: activeDiagramHeight,
    diagram_image_alignment: activeDiagramAlign,
    uncertainty: `0.00${decimalPlaces === 4 ? "15" : "2"} ${defaultUnit}`,
    verdict: failPoints > 0 ? "FAIL" : "PASS",
    environmental_conditions: {
      temperature: "20.0 ± 1.0 °C",
      humidity: "50 ± 5 % RH",
      pressure: "1013.2 hPa",
      soaking_time: "4 Hours",
    },
    procedure_reference: procedureReference || "WI/CAL/01 (Accredited Calibration Procedure)",
    procedure_no: procedureNo || undefined,
    procedure_name: procedureName || undefined,
    procedure_date: procedureDate || undefined,
    procedure_rev: procedureRev || undefined,
    acceptance_criteria_doc_no: acceptanceCriteriaDocNo || undefined,
    acceptance_criteria_date: acceptanceCriteriaDate || undefined,
    acceptance_criteria_rev: acceptanceCriteriaRev || undefined,
    acceptance_criteria_reference: acceptanceCriteriaReference || undefined,
    reference_standard_name: "Length Master / Caliper Checker / Slip Gauge Set",
    reference_standard_id: "REF-STD-01",
    reference_standard_traceable_to: "NPL (National Physical Laboratory)",
    reference_standard_validity: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    calibrated_by: "Calibration Engineer",
    calibrated_by_designation: "Sr. Metrology Engineer",
    reviewed_by: "Quality Inspector",
    reviewed_by_designation: "QA Lead",
    approved_by: "Authorized Signatory",
    approved_by_designation: "Laboratory Head / Quality Manager",
    instrument: {
      id: "INST-TRIAL-01",
      name: templateName,
      equipment_id: "GM-EQ-8492",
      serial_no: "SN-948201",
      make: "Mitutoyo / Baker / Standard",
      model: "Standard Model",
      range: `0 - 150 ${defaultUnit}`,
      least_count: `0.0${decimalPlaces >= 3 ? "01" : "1"} ${defaultUnit}`,
      location: "Quality Control / Calibration Lab",
      department: "Mechanical Metrology",
      status: "active",
    } as any,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                  Template Trial Run & Live Verification
                  <Badge variant="outline" className="text-[10px] text-cyan-300 border-cyan-500/40 bg-cyan-500/10">
                    Interactive Mode
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300">
                  Enter sample calibration readings to test formula recalculation, tolerances, and view the simulated certificate.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill("pass")}
                className="h-7 text-xs bg-emerald-950/60 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900 gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Fill PASS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill("fail")}
                className="h-7 text-xs bg-rose-950/60 border-rose-600/40 text-rose-300 hover:bg-rose-900 gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Fill FAIL
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 bg-muted/20 border-b flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-2 w-72">
              <TabsTrigger value="test" className="text-xs gap-1.5 font-bold">
                <Sliders className="w-3.5 h-3.5" /> Live Data Entry
              </TabsTrigger>
              <TabsTrigger value="certificate" className="text-xs gap-1.5 font-bold">
                <FileCheck2 className="w-3.5 h-3.5" /> Certificate Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Pass/Fail Metrics Bar */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">Checked Points: {totalPoints}</span>
            <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
              <Check className="w-3 h-3" /> {passPoints} PASS
            </Badge>
            {failPoints > 0 && (
              <Badge className="bg-rose-600 text-white text-[10px] gap-1">
                <XCircle className="w-3 h-3" /> {failPoints} FAIL
              </Badge>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: LIVE DATA ENTRY & FORMULA VERIFICATION */}
          {activeTab === "test" && (
            <div className="space-y-4">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-950 dark:text-cyan-200 flex items-center justify-between">
                <span>
                  💡 <strong>Test Gauge Precision:</strong> Type observed numbers into the <strong>Reading</strong> columns. Formula values (`Error`, `Average`, `Judgement`) recalculate automatically.
                </span>
                <span className="font-mono text-[11px] font-bold">Tol: ±{defaultTolerance} {defaultUnit}</span>
              </div>

              {testBlocks.map((block, bIdx) => (
                <div key={block.id || bIdx} className="space-y-2">
                  {block.type === "table_grid" && (() => {
                    const tbl = block as TableGridBlock;
                    const effOrient = getEffectiveTableOrientation(tbl);
                    const displayCols = (tbl.columns || []).filter(
                      (c) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino" && c.id !== "slno"
                    );

                    return (
                      <div className="border border-black overflow-hidden bg-white dark:bg-slate-900 rounded-sm shadow-xs">
                        <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-3 py-1.5 flex items-center justify-between border-b border-black text-xs font-bold">
                          <span className="flex items-center gap-1.5">
                            <Table className="w-3.5 h-3.5 text-primary" />
                            {tbl.title}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                            <span>Unit: {tbl.unit || defaultUnit}</span>
                            <span>• Tol: ±{tbl.tolerance ?? defaultTolerance}</span>
                            <span>• Dec: {tbl.decimal_places ?? decimalPlaces}</span>
                            <Badge variant="outline" className="text-[9px] font-mono uppercase bg-background/50">
                              {effOrient}
                            </Badge>
                          </div>
                        </div>

                        {effOrient === "horizontal" ? (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs text-center border-black" style={{ tableLayout: 'auto' }}>
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black text-[11px]">
                                  <th className="py-1.5 px-2 text-left bg-slate-200/80 dark:bg-slate-700/80 font-bold w-36 min-w-[140px] text-black dark:text-white">
                                    Parameter / Sl no
                                  </th>
                                  {tbl.rows.map((r, rIdx) => (
                                    <th key={rIdx} className="py-1 px-1.5 font-bold min-w-[55px] text-black dark:text-white">
                                      {r.point_number ?? (rIdx + 1)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black font-mono">
                                {displayCols.map((col) => (
                                  <tr key={col.id} className="divide-x divide-black hover:bg-slate-50/50">
                                    <td className="py-1 px-2 text-left font-bold bg-slate-50 dark:bg-slate-800/60 text-[11px] font-sans text-black dark:text-slate-200">
                                      {col.label}
                                      {col.type === "formula" && <span className="text-[9px] text-primary ml-1 font-normal">(fx)</span>}
                                    </td>
                                    {tbl.rows.map((row, rIdx) => {
                                      const dec = tbl.decimal_places ?? decimalPlaces ?? 3;
                                      if (col.type === "nominal") {
                                        const cellVal = row[col.id] !== undefined ? row[col.id] : row.nominal;
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 font-bold font-mono text-foreground">
                                            {typeof cellVal === "number" ? cellVal.toFixed(dec) : String(cellVal ?? "-")}
                                          </td>
                                        );
                                      }
                                      if (col.type === "reading" || col.type === "trial") {
                                        return (
                                          <td key={rIdx} className="p-1">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={row[col.id] ?? ""}
                                              onChange={(e) => handleCellChange(bIdx, rIdx, col.id, e.target.value)}
                                              className="h-6 text-xs text-center font-mono font-bold bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-400/50 focus-visible:ring-1 focus-visible:ring-cyan-500"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "formula") {
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 font-mono font-bold text-primary">
                                            {row[col.id] ?? "-"}
                                          </td>
                                        );
                                      }
                                      if (col.type === "status") {
                                        const isPass = row[col.id] === "PASS";
                                        return (
                                          <td key={rIdx} className="py-1 px-1">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              isPass
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                            }`}>
                                              {row[col.id] || "-"}
                                            </span>
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={rIdx} className="py-1 px-1.5">
                                          {row[col.id] || "-"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs text-center border-black">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black text-[11px]">
                                  {tbl.columns.map((col) => (
                                    <th key={col.id} style={{ width: col.width }} className="py-1.5 px-2">
                                      {col.label}
                                      {col.type === "formula" && <span className="text-[9px] text-primary block font-normal">(fx)</span>}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black">
                                {tbl.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                                    {tbl.columns.map((col) => {
                                      const dec = tbl.decimal_places ?? decimalPlaces ?? 3;
                                      if (col.id === "point_number" || col.id === "sl_no") {
                                        return <td key={col.id} className="py-1 px-2 font-bold text-slate-700 dark:text-slate-300">{row.point_number ?? (rIdx + 1)}</td>;
                                      }
                                      if (col.type === "nominal") {
                                        const cellVal = row[col.id] !== undefined ? row[col.id] : row.nominal;
                                        return <td key={col.id} className="py-1 px-2 font-bold font-mono">{typeof cellVal === "number" ? cellVal.toFixed(dec) : String(cellVal ?? "-")}</td>;
                                      }
                                      if (col.type === "reading" || col.type === "trial") {
                                        return (
                                          <td key={col.id} className="p-1">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={row[col.id] ?? ""}
                                              onChange={(e) => handleCellChange(bIdx, rIdx, col.id, e.target.value)}
                                              className="h-6 text-xs text-center font-mono font-bold bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-400/50 focus-visible:ring-1 focus-visible:ring-cyan-500"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "formula") {
                                        return (
                                          <td key={col.id} className="py-1 px-2 font-mono font-bold text-primary">
                                            {row[col.id] ?? "-"}
                                          </td>
                                        );
                                      }
                                      if (col.type === "status") {
                                        const isPass = row[col.id] === "PASS";
                                        return (
                                          <td key={col.id} className="py-1 px-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                              isPass
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                            }`}>
                                              {row[col.id] || "-"}
                                            </span>
                                          </td>
                                        );
                                      }
                                      return <td key={col.id} className="py-1 px-2">{row[col.id] ?? "-"}</td>;
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {block.type === "matrix_table" && (
                    <div className="border border-black overflow-hidden bg-white dark:bg-slate-900 rounded-sm">
                      <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-3 py-1 text-xs font-bold border-b border-black">
                        {(block as MatrixTableBlock).title}
                      </div>
                      <table className="w-full border-collapse text-xs text-center border-black">
                        <thead>
                          {(block as MatrixTableBlock).headers.map((hRow, hIdx) => (
                            <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                              {hRow.map((cell, cIdx) => (
                                <th key={cIdx} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="py-1 px-2">{cell.text}</th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="divide-y divide-black">
                          {(block as MatrixTableBlock).rows.map((r, rIdx) => (
                            <tr key={rIdx} className="divide-x divide-black">
                              {r.map((val, cIdx) => (
                                <td key={cIdx} className="py-1 px-2 font-mono">{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {block.type === "text_block" && (
                    <div className="p-2.5 border border-black bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center gap-2 rounded-sm">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{(block as TextBlock).content}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: ACTUAL CERTIFICATE PREVIEW (STANDARDIZED NABL ISO/IEC 17025 LAYOUT) */}
          {activeTab === "certificate" && (
            <div className="flex justify-center bg-slate-200/60 dark:bg-slate-950 p-2 sm:p-5 rounded-xl border border-slate-300 dark:border-slate-800 overflow-x-auto">
              <div className="w-full max-w-[860px] shadow-2xl bg-white dark:bg-slate-900 rounded-sm">
                <CertificatePreview
                  calibration={mockCalibrationRecord}
                  instrumentName={templateName}
                  showDownloadPng={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-muted/40 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close Trial Run
          </Button>

          <Button
            size="sm"
            onClick={() => {
              window.print();
            }}
            className="gap-2 bg-slate-800 hover:bg-slate-700 text-white"
          >
            Print Certificate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
