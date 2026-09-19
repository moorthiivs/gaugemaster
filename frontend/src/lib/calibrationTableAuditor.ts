/**
 * Gaugemaster Metrology & Calibration Intelligence
 * Calibration Table Auditor & Semantic Intelligence Engine
 *
 * Audits entire calibration tables, infers column metrology roles, data types,
 * calculation models, validates formulas with 7-layer validation,
 * checks tolerance structures, detects missing or unsupported formulas,
 * and provides atomic table-level repairs.
 */

import {
  TableGridBlock,
  CanvasColumnDef,
  ColumnRole,
  ColumnSemanticRole,
  ColumnDataType,
  CalibrationCalculationModel
} from "../types/template";
import { validateFormula, detectFormulaCycles } from "./formulaEngine";
import { translateExcelFormula } from "./excelFormulaTranslator";
import { runMetrologyBoundaryTests, BoundaryTestReport } from "./metrologyBoundaryTester";

export interface ColumnAuditItem {
  columnId: string;
  columnLabel: string;
  inferredRole: ColumnRole;
  semanticRole: ColumnSemanticRole;
  dataType: ColumnDataType;
  currentFormula?: string;
  sourceFormula?: string;
  formulaStatus: "VALID" | "VALIDATED" | "NEEDS_REVIEW" | "INVALID";
  formulaSource?: CanvasColumnDef["formulaSource"];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  dependencies: string[];
  issues: string[];
  recommendedFormula?: string;
  recommendationReason?: string;
  boundaryReport?: BoundaryTestReport;
  metrologySuitability?: {
    isSuitable: boolean;
    reason?: string;
  };
}

export interface TableHealthSummary {
  totalColumns: number;
  inputColumns: number;
  calculatedColumns: number;
  judgementColumns: number;
  validFormulas: number;
  needsReviewFormulas: number;
  boundaryTestsPassed: number;
  cyclesDetected: number;
  calculationModel: CalibrationCalculationModel;
  certificateReadiness: "READY FOR TRIAL RUN" | "REVIEW REQUIRED" | "BLOCKED";
}

export interface TableAuditReport {
  tableId: string;
  tableTitle: string;
  calculationModel: CalibrationCalculationModel;
  overallStatus: "VALIDATED" | "NEEDS_REVIEW" | "CRITICAL_ISSUES";
  toleranceClassification: "symmetric" | "asymmetric" | "mixed" | "row_specific" | "uniform";
  columnsCount: number;
  calculatedColumnsCount: number;
  issuesCount: number;
  warningsCount: number;
  healthSummary: TableHealthSummary;
  columnAudits: ColumnAuditItem[];
  circularDependencies: string[][];
  summary: string;
}

/**
 * Infer calibration calculation model from table structure, columns, and rows.
 */
export function inferTableCalculationModel(table: TableGridBlock): CalibrationCalculationModel {
  if (table.calculationModel) {
    return table.calculationModel;
  }

  const cols = table.columns || [];
  const colLabels = cols.map(c => (c.label || "").toLowerCase());
  const colIds = cols.map(c => (c.id || "").toLowerCase());

  const hasTrialCols = cols.some(c =>
    c.type === "trial" ||
    /^(t[1-9]|trial\s*[1-9]|run\s*[1-9])/i.test(c.label || "") ||
    /^(t[1-9]|trial_[1-9])/i.test(c.id || "")
  );

  const hasAverage = cols.some(c =>
    /average|mean|avg/i.test(c.label || "") ||
    /average|mean|avg/i.test(c.id || "")
  );

  const hasErrorOrDev = cols.some(c =>
    /error|deviation|diff/i.test(c.label || "") ||
    /error|deviation/i.test(c.id || "")
  );

  const hasRepeatability = cols.some(c =>
    /repeatability|spread|max\s*-\s*min|range/i.test(c.label || "") ||
    /repeatability|spread/i.test(c.id || "")
  );

  const hasMpe = cols.some(c =>
    /\bmpe\b|permissible\s*error|limit\s*of\s*error/i.test(c.label || "") ||
    /\bmpe\b/i.test(c.id || "")
  );

  const hasLowerUpperLimits =
    cols.some(c => /lower\s*limit|min\s*limit/i.test(c.label || "") || /lower_limit/i.test(c.id || "")) &&
    cols.some(c => /upper\s*limit|max\s*limit/i.test(c.label || "") || /upper_limit/i.test(c.id || ""));

  const hasUncertainty = cols.some(c =>
    /uncertainty|\bu\b|\bk\s*=\s*2/i.test(c.label || "") ||
    /uncertainty/i.test(c.id || "")
  );

  if (hasTrialCols && hasAverage && hasErrorOrDev) {
    return "MULTI_TRIAL_ERROR";
  }
  if (hasTrialCols && hasAverage) {
    return "MULTI_TRIAL_AVERAGE";
  }
  if (hasRepeatability) {
    return "REPEATABILITY";
  }
  if (hasMpe) {
    return "MPE_COMPARISON";
  }
  if (hasUncertainty) {
    return "UNCERTAINTY";
  }
  if (hasLowerUpperLimits) {
    return "LIMIT_COMPARISON";
  }
  if (hasErrorOrDev) {
    return "DIRECT_DEVIATION";
  }

  const hasJudgementOnly = cols.some(c => /judgement|status|result/i.test(c.label || ""));
  const hasReadings = cols.some(c => c.type === "reading" || /actual|observed|reading/i.test(c.label || ""));
  if (hasJudgementOnly && !hasReadings) {
    return "PASS_FAIL";
  }

  return "DIRECT_DEVIATION";
}

/**
 * Infer column metrology role based on labels, types, and standard engineering terminology.
 */
export function inferColumnMetrologyRole(col: CanvasColumnDef): ColumnRole {
  if (col.role && col.role !== "UNKNOWN") {
    return col.role;
  }

  const label = (col.label || "").toLowerCase().trim();
  const id = (col.id || "").toLowerCase().trim();

  if (/^(sl\.?\s*no|seq|item|#|no\.?|point)$/i.test(label) || id === "sl_no" || id === "point_number") {
    return "METADATA";
  }
  if (/required\s*dim|specification|spec|size|parameter/i.test(label)) {
    return "SPECIFICATION";
  }
  if (/nominal|basic|standard\s*val/i.test(label) || id === "nominal") {
    return "NOMINAL";
  }
  if (/lower\s*limit|min\s*limit|lower\s*spec/i.test(label) || id.includes("lower_limit") || id.includes("min_limit")) {
    return "LOWER_LIMIT";
  }
  if (/upper\s*limit|max\s*limit|upper\s*spec/i.test(label) || id.includes("upper_limit") || id.includes("max_limit")) {
    return "UPPER_LIMIT";
  }
  if (/tolerance|tol|permissible\s*error|mpe/i.test(label)) {
    return "TOLERANCE";
  }
  if (/actual|reading|observed|measured|display/i.test(label) || col.type === "reading" || id.includes("actual") || id.includes("reading")) {
    return "READING";
  }
  if (/deviation|error|diff|variation/i.test(label) || id.includes("deviation") || id.includes("error")) {
    return "CALCULATED";
  }
  if (/judgement|status|result|acceptance|pass\/fail/i.test(label) || col.type === "status" || id.includes("judgement") || id.includes("status")) {
    return "JUDGEMENT";
  }
  if (/trial|t[1-9]|run|repeat/i.test(label) || col.type === "trial") {
    return "INPUT";
  }
  if (/average|mean|avg/i.test(label)) {
    return "CALCULATED";
  }
  if (/remarks|notes|comment/i.test(label)) {
    return "DISPLAY_ONLY";
  }

  if (col.formula) {
    return "CALCULATED";
  }

  return "UNKNOWN";
}

/**
 * Map legacy ColumnRole to new high-fidelity ColumnSemanticRole
 */
export function mapToSemanticRole(role: ColumnRole | undefined, col: CanvasColumnDef): ColumnSemanticRole {
  if (col.semanticRole) return col.semanticRole;
  switch (role) {
    case "METADATA": return "METADATA";
    case "SPECIFICATION":
    case "NOMINAL":
    case "LOWER_LIMIT":
    case "UPPER_LIMIT":
    case "TOLERANCE": return "SPECIFICATION";
    case "READING":
    case "INPUT": return col.type === "trial" ? "TRIAL" : "INPUT";
    case "CALCULATED": return "CALCULATED";
    case "JUDGEMENT": return "JUDGEMENT";
    case "DISPLAY_ONLY": return "PRESENTATION";
    default:
      if (col.formula) return "CALCULATED";
      return "UNKNOWN";
  }
}

/**
 * Infer the column data type
 */
export function inferColumnDataType(col: CanvasColumnDef): ColumnDataType {
  if (col.dataType) return col.dataType;

  const label = (col.label || "").toLowerCase();
  const id = (col.id || "").toLowerCase();

  if (/sl\.?\s*no|seq|item|point/i.test(label) || id === "sl_no") {
    return "INTEGER";
  }
  if (/date/i.test(label) || id.includes("date")) {
    return "DATE";
  }
  if (/judgement|status|result|acceptance/i.test(label) || col.type === "status") {
    return "STATUS";
  }
  if (col.formula) {
    return "FORMULA";
  }
  if (/actual|reading|nominal|dimension|size|deviation|error|average|limit|tolerance|mpe|uncertainty/i.test(label) ||
      col.type === "reading" || col.type === "nominal" || col.type === "number") {
    return "MEASUREMENT";
  }
  if (/remark|note|description|comment|name/i.test(label) || col.type === "text") {
    return "TEXT";
  }

  return "NUMBER";
}

/**
 * Audit an entire TableGridBlock for metrology correctness, formula integrity, and tolerance handling.
 */
export function auditCalibrationTable(table: TableGridBlock): TableAuditReport {
  const columns = table.columns || [];
  const rows = table.rows || [];
  const columnAudits: ColumnAuditItem[] = [];

  const calcModel = inferTableCalculationModel(table);

  // Check circular dependencies across the entire table
  const circularDependencies = detectFormulaCycles(columns);

  // Analyze table row tolerances to classify tolerance distribution
  let hasSymmetric = false;
  let hasAsymmetric = false;
  let hasRowSpecificVariations = false;
  let firstTol: number | null = null;

  for (const row of rows) {
    if (typeof row.tolerance === "number") {
      if (firstTol === null) firstTol = row.tolerance;
      else if (Math.abs(row.tolerance - firstTol) > 1e-6) hasRowSpecificVariations = true;
      hasSymmetric = true;
    }
    const cf = row.customFields || {};
    if (cf.lowerTolerance !== undefined && cf.upperTolerance !== undefined) {
      if (Math.abs(Math.abs(cf.lowerTolerance) - Math.abs(cf.upperTolerance)) > 1e-6) {
        hasAsymmetric = true;
      } else {
        hasSymmetric = true;
      }
    }
  }

  let toleranceClassification: TableAuditReport["toleranceClassification"] = "uniform";
  if (hasRowSpecificVariations || (hasSymmetric && hasAsymmetric)) {
    toleranceClassification = "mixed";
  } else if (hasAsymmetric) {
    toleranceClassification = "asymmetric";
  } else if (hasSymmetric) {
    toleranceClassification = "symmetric";
  }

  // Identify key canonical columns
  const readingCol = columns.find(c => c.type === "reading" || inferColumnMetrologyRole(c) === "READING");
  const nominalCol = columns.find(c => {
    const id = (c.id || "").toLowerCase().trim();
    const lbl = (c.label || "").toLowerCase().trim();
    if (id === "point_number" || id === "sl_no" || id === "sino" || id === "slno" || id === "seq" || id === "item") return false;
    if (/^(sl\.?\s*no|seq|item|#|no\.?|point)$/i.test(lbl)) return false;
    if (/specification|required\s*dim|condition|receipt/i.test(lbl)) return false;
    return c.type === "nominal" || inferColumnMetrologyRole(c) === "NOMINAL";
  });
  const lowerLimitCol = columns.find(c => inferColumnMetrologyRole(c) === "LOWER_LIMIT");
  const upperLimitCol = columns.find(c => inferColumnMetrologyRole(c) === "UPPER_LIMIT");
  const mpeCol = columns.find(c => /\bmpe\b/i.test(c.label || "") || /\bmpe\b/i.test(c.id || ""));
  const avgCol = columns.find(c => /average|avg|mean/i.test(c.label || "") || /average|avg/i.test(c.id || ""));
  const trialCols = columns.filter(c =>
    c.type === "trial" ||
    /^(t[1-9]|trial\s*[1-9]|run\s*[1-9])/i.test(c.label || "") ||
    /^(t[1-9]|trial_[1-9])/i.test(c.id || "")
  );

  const readingVar = readingCol ? readingCol.id : "actual_dimension";
  const nominalVar = nominalCol ? nominalCol.id : "nominal";
  const lowerLimitVar = lowerLimitCol ? lowerLimitCol.id : "lower_limit";
  const upperLimitVar = upperLimitCol ? upperLimitCol.id : "upper_limit";
  const mpeVar = mpeCol ? mpeCol.id : "mpe";
  const avgVar = avgCol ? avgCol.id : "average";

  let issuesCount = 0;
  let warningsCount = 0;
  let validFormulasCount = 0;
  let needsReviewCount = 0;
  let boundaryPassCount = 0;

  for (const col of columns) {
    const role = inferColumnMetrologyRole(col);
    const semanticRole = mapToSemanticRole(role, col);
    const dataType = inferColumnDataType(col);
    const formula = (col.formula || "").trim();
    const sourceFormula = col.sourceFormula;
    const issues: string[] = [];
    let recommendedFormula: string | undefined;
    let recommendationReason: string | undefined;
    let confidence: "HIGH" | "MEDIUM" | "LOW" = col.formulaConfidence || "HIGH";
    let status: ColumnAuditItem["formulaStatus"] = "VALID";
    let boundaryReport: BoundaryTestReport | undefined;
    let metrologySuitability: { isSuitable: boolean; reason?: string } | undefined;

    // Check if column is in a circular dependency
    const inCycle = circularDependencies.some(cycle => cycle.includes(col.id));
    if (inCycle) {
      issues.push(`Circular formula dependency detected involving column ${col.id}.`);
      status = "INVALID";
      issuesCount++;
    }

    if (formula) {
      // Validate formula with 7-layer validation
      const valResult = validateFormula(formula, columns, calcModel);

      if (!valResult.isValid) {
        status = "NEEDS_REVIEW";
        issuesCount++;
        needsReviewCount++;
        issues.push(...valResult.errors);

        // Check if formula has unsupported Excel functions (e.g. CHOOSE, ROW, INDEX)
        const unsupportedFuncs = valResult.unsupportedFunctions || [];
        if (unsupportedFuncs.length > 0 || (sourceFormula && /choose|row\(|index/i.test(sourceFormula))) {
          const transResult = translateExcelFormula(sourceFormula || formula, columns, col);
          if (transResult.translatedFormula) {
            recommendedFormula = transResult.translatedFormula;
            recommendationReason = transResult.reason;
            confidence = transResult.confidence;
          }
        }
      } else {
        status = "VALIDATED";
        validFormulasCount++;
        if (valResult.warnings && valResult.warnings.length > 0) {
          warningsCount += valResult.warnings.length;
          issues.push(...valResult.warnings);
        }
      }

      if (valResult.suitabilityValid !== undefined) {
        metrologySuitability = {
          isSuitable: valResult.suitabilityValid,
          reason: valResult.suitabilityReason
        };
        if (!valResult.suitabilityValid && valResult.suitabilityReason) {
          warningsCount++;
          issues.push(valResult.suitabilityReason);
        }
      }

      // Check boundary tests for judgement or calculated tolerance columns
      if (role === "JUDGEMENT" || col.type === "status" || col.label.toLowerCase().includes("judgement")) {
        const sampleNominal = typeof rows[0]?.nominal === "number" ? rows[0].nominal : (parseFloat(String(rows[0]?.nominal ?? 35.035)) || 35.035);
        const sampleLower = typeof rows[0]?.lower_limit === "number" ? rows[0].lower_limit : (typeof rows[0]?.lowerLimit === "number" ? rows[0].lowerLimit : (rows[0]?.customFields?.lowerLimit ?? (sampleNominal - (table.tolerance ?? 0.02))));
        const sampleUpper = typeof rows[0]?.upper_limit === "number" ? rows[0].upper_limit : (typeof rows[0]?.upperLimit === "number" ? rows[0].upperLimit : (rows[0]?.customFields?.upperLimit ?? (sampleNominal + (table.tolerance ?? 0.02))));
        const precision = col.decimal_places ?? table.decimal_places ?? 3;

        const effectiveReadingVar = (/average|avg/i.test(formula) || calcModel === "MULTI_TRIAL_ERROR" || calcModel === "MULTI_TRIAL_AVERAGE")
          ? (avgVar || "average")
          : readingVar;

        boundaryReport = runMetrologyBoundaryTests({
          formula,
          nominal: sampleNominal,
          lowerLimit: sampleLower,
          upperLimit: sampleUpper,
          decimalPlaces: precision,
          readingVarName: effectiveReadingVar
        });

        if (boundaryReport.allPassed) {
          boundaryPassCount++;
        } else {
          warningsCount++;
          issues.push(`Boundary tests warning: ${boundaryReport.passedCount}/${boundaryReport.totalCount} passed. Review tolerance limits or blank handling.`);
        }
      }
    } else {
      // Column does NOT have a formula currently:
      // Provide model-tailored recommendations:
      if (role === "CALCULATED" || semanticRole === "CALCULATED") {
        if (/average|mean|avg/i.test(col.label) && trialCols.length > 0) {
          recommendedFormula = `AVERAGE(${trialCols.map(c => c.id).join(", ")})`;
          recommendationReason = `Model-tailored average calculation over ${trialCols.length} trial readings.`;
          confidence = "HIGH";
          warningsCount++;
          issues.push("Average column has no formula defined.");
        } else if (/deviation|error/i.test(col.label)) {
          const effectiveMeasured = (calcModel === "MULTI_TRIAL_ERROR" && avgCol) ? avgVar : readingVar;
          recommendedFormula = `${effectiveMeasured} - ${nominalVar}`;
          recommendationReason = `Standard metrological error formula: ${effectiveMeasured} minus ${nominalVar}.`;
          confidence = "HIGH";
          warningsCount++;
          issues.push("Calculated deviation/error column has no formula defined.");
        } else if (/repeatability|spread/i.test(col.label) && trialCols.length > 0) {
          recommendedFormula = `MAX(${trialCols.map(c => c.id).join(", ")}) - MIN(${trialCols.map(c => c.id).join(", ")})`;
          recommendationReason = "Metrological repeatability spread: Maximum trial minus Minimum trial.";
          confidence = "HIGH";
          warningsCount++;
          issues.push("Repeatability column has no formula defined.");
        }
      } else if (role === "JUDGEMENT" || semanticRole === "JUDGEMENT") {
        if (calcModel === "MPE_COMPARISON" && mpeCol) {
          const errCol = columns.find(c => /error|deviation/i.test(c.label || "") || /error|deviation/i.test(c.id || ""));
          const errVar = errCol ? errCol.id : "error";
          recommendedFormula = `IF(ISBLANK(${readingVar}), "-", IF(ABS(${errVar}) <= ${mpeVar}, "PASS", "FAIL"))`;
          recommendationReason = "MPE acceptance rule: Absolute error within Maximum Permissible Error with safe blank handling.";
          confidence = "HIGH";
          warningsCount++;
          issues.push("Judgement column has no MPE acceptance formula defined.");
        } else if (lowerLimitCol && upperLimitCol) {
          const testVar = (calcModel === "MULTI_TRIAL_AVERAGE" || calcModel === "MULTI_TRIAL_ERROR") && avgCol ? avgVar : readingVar;
          recommendedFormula = `IF(ISBLANK(${testVar}), "-", IF(AND(${testVar} >= ${lowerLimitVar}, ${testVar} <= ${upperLimitVar}), "PASS", "FAIL"))`;
          recommendationReason = "Standard metrological acceptance formula with row-specific limit comparison and blank handling.";
          confidence = "HIGH";
          warningsCount++;
          issues.push("Judgement column has no formula defined.");
        } else {
          recommendedFormula = `IF(ISBLANK(${readingVar}), "-", IF(AND(${readingVar} >= ${lowerLimitVar}, ${readingVar} <= ${upperLimitVar}), "PASS", "FAIL"))`;
          recommendationReason = "Standard acceptance rule with blank handling.";
          confidence = "MEDIUM";
          warningsCount++;
          issues.push("Judgement column has no formula defined.");
        }
      }
    }

    columnAudits.push({
      columnId: col.id,
      columnLabel: col.label,
      inferredRole: role,
      semanticRole,
      dataType,
      currentFormula: formula || undefined,
      sourceFormula,
      formulaStatus: status,
      formulaSource: col.formulaSource,
      confidence,
      dependencies: col.dependsOn || [],
      issues,
      recommendedFormula,
      recommendationReason,
      boundaryReport,
      metrologySuitability
    });
  }

  let overallStatus: TableAuditReport["overallStatus"] = "VALIDATED";
  if (issuesCount > 0) {
    overallStatus = circularDependencies.length > 0 ? "CRITICAL_ISSUES" : "NEEDS_REVIEW";
  } else if (warningsCount > 0) {
    overallStatus = "NEEDS_REVIEW";
  }

  const calculatedCols = columns.filter(c => !!c.formula);
  const inputCols = columns.filter(c => c.type === "reading" || c.type === "trial" || inferColumnMetrologyRole(c) === "READING" || inferColumnMetrologyRole(c) === "INPUT");
  const judgementCols = columns.filter(c => inferColumnMetrologyRole(c) === "JUDGEMENT");

  let certificateReadiness: TableHealthSummary["certificateReadiness"] = "READY FOR TRIAL RUN";
  if (circularDependencies.length > 0 || issuesCount > 0) {
    certificateReadiness = "BLOCKED";
  } else if (warningsCount > 0 || needsReviewCount > 0) {
    certificateReadiness = "REVIEW REQUIRED";
  }

  const healthSummary: TableHealthSummary = {
    totalColumns: columns.length,
    inputColumns: inputCols.length,
    calculatedColumns: calculatedCols.length,
    judgementColumns: judgementCols.length,
    validFormulas: validFormulasCount,
    needsReviewFormulas: needsReviewCount,
    boundaryTestsPassed: boundaryPassCount,
    cyclesDetected: circularDependencies.length,
    calculationModel: calcModel,
    certificateReadiness
  };

  const summary = overallStatus === "VALIDATED"
    ? `All ${columns.length} columns and formulas validated successfully for model [${calcModel}]. Ready for trial run and certificate production.`
    : `Found ${issuesCount} issues and ${warningsCount} warnings across ${columns.length} columns under model [${calcModel}]. Review AI recommendations before finalizing.`;

  return {
    tableId: table.id,
    tableTitle: table.title,
    calculationModel: calcModel,
    overallStatus,
    toleranceClassification,
    columnsCount: columns.length,
    calculatedColumnsCount: calculatedCols.length,
    issuesCount,
    warningsCount,
    healthSummary,
    columnAudits,
    circularDependencies,
    summary
  };
}

/**
 * Atomically apply AI-audited fixes to all columns in a table.
 */
export function generateFixedTableColumns(table: TableGridBlock): {
  columns: CanvasColumnDef[];
  changedCount: number;
  changeLog: Array<{ columnId: string; before: string; after: string; reason: string }>;
} {
  const audit = auditCalibrationTable(table);
  const changeLog: Array<{ columnId: string; before: string; after: string; reason: string }> = [];
  let changedCount = 0;

  const newColumns = (table.columns || []).map(col => {
    const auditItem = audit.columnAudits.find(a => a.columnId === col.id);
    if (auditItem && auditItem.recommendedFormula && auditItem.recommendedFormula !== col.formula) {
      changedCount++;
      changeLog.push({
        columnId: col.id,
        before: col.formula || "(none)",
        after: auditItem.recommendedFormula,
        reason: auditItem.recommendationReason || "AI normalization to canonical semantic formula."
      });

      const isExcelOrigin =
        Boolean(col.sourceFormula) ||
        Boolean(col.formula?.startsWith("=")) ||
        col.formulaSource === "EXCEL_TRANSLATED" ||
        /choose|row\(|index|lookup|vlookup/i.test(col.formula || "");

      return {
        ...col,
        semanticRole: auditItem.semanticRole,
        dataType: auditItem.dataType,
        formula: auditItem.recommendedFormula,
        sourceFormula: col.sourceFormula || (col.formula?.startsWith("=") ? col.formula : undefined),
        formulaStatus: "VALIDATED" as const,
        formulaConfidence: auditItem.confidence,
        formulaSource: isExcelOrigin ? ("EXCEL_TRANSLATED" as const) : ("SYSTEM_GENERATED" as const),
        translationReason: auditItem.recommendationReason,
        aiSuggestedFormula: undefined,
        aiReason: undefined
      };
    }

    // Keep semantic role and data type updated even if formula didn't change
    if (auditItem) {
      return {
        ...col,
        semanticRole: col.semanticRole || auditItem.semanticRole,
        dataType: col.dataType || auditItem.dataType
      };
    }

    return col;
  });

  return {
    columns: newColumns,
    changedCount,
    changeLog
  };
}
