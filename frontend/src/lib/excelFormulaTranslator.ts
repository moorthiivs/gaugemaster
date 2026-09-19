/**
 * Gaugemaster Metrology & Calibration Intelligence
 * Excel Formula Semantic Translator
 *
 * Translates Excel-origin formulas (with layout dependencies like ROW()-k, CHOOSE,
 * INDEX, cell coordinates D31-C31, etc.) into Gaugemaster's canonical semantic formula DSL.
 *
 * Preserves metrology semantics and stores original formula verbatim for auditability.
 */

import { CanvasColumnDef } from "../types/template";
import { parseFormulaAST, validateFormula } from "./formulaEngine";

export interface ExcelTranslationResult {
  translatedFormula: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  explanation?: string;
  dependencies: string[];
  originalFormula: string;
  isSupported: boolean;
  unsupportedFunctions: string[];
}

/**
 * Common Excel functions that may appear in imported sheets.
 */
const KNOWN_EXCEL_FUNCTIONS = [
  "CHOOSE",
  "ROW",
  "COLUMN",
  "INDEX",
  "MATCH",
  "VLOOKUP",
  "XLOOKUP",
  "OFFSET",
  "INDIRECT",
  "COUNTA",
  "COUNTIF",
  "SUMIF",
  "AVERAGEIF",
  "ISBLANK",
  "ISERROR",
  "IFERROR",
  "IFNA",
  "IF",
  "AND",
  "OR",
  "NOT",
  "ABS",
  "ROUND",
  "AVERAGE",
  "SUM",
  "MIN",
  "MAX",
  "COUNT",
  "STDEV",
  "STDEV.S",
  "STDEV.P"
];

/**
 * Standard functions directly supported by Gaugemaster formula engine.
 */
const SUPPORTED_ENGINE_FUNCTIONS = new Set([
  "ABS",
  "ROUND",
  "AVERAGE",
  "AVG",
  "MIN",
  "MAX",
  "SUM",
  "SQRT",
  "POW",
  "IF",
  "AND",
  "OR",
  "NOT",
  "ISBLANK",
  "COUNT"
]);

/**
 * Extract all function names invoked in a formula string.
 */
export function identifyExcelFunctions(formula: string): string[] {
  if (!formula) return [];
  const clean = formula.startsWith("=") ? formula.slice(1) : formula;
  const funcRegex = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(clean)) !== null) {
    found.add(match[1].toUpperCase());
  }
  return Array.from(found);
}

/**
 * Resolve preferred variable names for a table context.
 */
function resolveCanonicalNames(tableColumns?: CanvasColumnDef[]): {
  readingVar: string;
  nominalVar: string;
  lowerLimitVar: string;
  upperLimitVar: string;
  deviationVar: string;
  judgementVar: string;
  averageVar: string;
  mpeVar: string;
  trialVars: string[];
} {
  let readingVar = "actual_dimension";
  let nominalVar = "nominal";
  let lowerLimitVar = "lower_limit";
  let upperLimitVar = "upper_limit";
  let deviationVar = "deviation";
  let judgementVar = "judgement";
  let averageVar = "average";
  let mpeVar = "mpe";
  const trialVars: string[] = [];

  if (tableColumns && tableColumns.length > 0) {
    for (const col of tableColumns) {
      const id = col.id.toLowerCase();
      const lbl = col.label.toLowerCase();

      if (col.type === "reading" || col.role === "READING" || lbl.includes("actual") || lbl.includes("reading") || lbl.includes("observed")) {
        readingVar = col.id;
      } else if (
        (col.type === "nominal" || col.role === "NOMINAL" || lbl.includes("nominal") || lbl.includes("basic") || lbl.includes("standard")) &&
        col.id !== "point_number" &&
        col.id !== "sl_no" &&
        col.id !== "sino" &&
        col.id !== "slno" &&
        !/^(sl\.?\s*no|seq|item|#|no\.?|point)$/i.test(lbl) &&
        !/specification|required\s*dim|condition|receipt/i.test(lbl)
      ) {
        nominalVar = col.id;
      } else if (col.role === "LOWER_LIMIT" || lbl.includes("lower limit") || lbl.includes("min limit")) {
        lowerLimitVar = col.id;
      } else if (col.role === "UPPER_LIMIT" || lbl.includes("upper limit") || lbl.includes("max limit")) {
        upperLimitVar = col.id;
      } else if (lbl.includes("deviation") || lbl.includes("error") || id.includes("deviation")) {
        deviationVar = col.id;
      } else if (lbl.includes("judgement") || lbl.includes("status") || lbl.includes("acceptance") || col.role === "JUDGEMENT") {
        judgementVar = col.id;
      } else if (lbl.includes("average") || lbl.includes("mean") || id.includes("average") || id.includes("avg")) {
        averageVar = col.id;
      } else if (lbl.includes("mpe") || id.includes("mpe")) {
        mpeVar = col.id;
      } else if (col.type === "trial" || /trial|t[1-9]|run[1-9]|obs[1-9]/i.test(col.label) || /t[1-9]/i.test(col.id)) {
        trialVars.push(col.id);
      }
    }
  }

  return { readingVar, nominalVar, lowerLimitVar, upperLimitVar, deviationVar, judgementVar, averageVar, mpeVar, trialVars };
}

/**
 * Generate clear plain-English explanation for a semantic formula.
 */
export function explainSemanticFormula(formula: string, role?: string): string {
  const norm = formula.trim().toLowerCase();

  if (norm.includes("average - nominal") || norm.includes("avg - nominal")) {
    return "Error is calculated as Multi-Trial Average reading minus Nominal Dimension for each point.";
  }
  if (norm.includes("actual_dimension - nominal") || norm.includes("actual - nominal") || norm.includes("reading - nominal")) {
    return "Deviation is calculated as Actual Dimension minus Nominal Dimension for each calibration point.";
  }
  if (norm.includes("nominal - actual") || norm.includes("nominal - reading")) {
    return "Correction/Error is calculated as Nominal Dimension minus Actual Dimension.";
  }
  if (norm.includes("average(") || norm.includes("avg(")) {
    return "Calculates the arithmetic mean of multiple observation trials, ignoring blank inputs.";
  }
  if (norm.includes("max(") && norm.includes("min(") && norm.includes("-")) {
    return "Calculates the repeat measurement range (Spread/Repeatability) as Maximum trial minus Minimum trial.";
  }
  if (norm.includes("abs(") && (norm.includes("mpe") || norm.includes("limit"))) {
    return "Judgement evaluates PASS when absolute error does not exceed Maximum Permissible Error (MPE); blank readings safely propagate '-'.";
  }
  if (norm.includes("lower_limit") && norm.includes("upper_limit")) {
    return "Judgement evaluates PASS when the measured dimension falls between lower and upper tolerance limits inclusive; otherwise FAIL (or '-' if reading is blank).";
  }
  if (norm.includes("abs(") && norm.includes("tolerance")) {
    return "Judgement evaluates PASS when absolute deviation is within maximum permissible tolerance.";
  }

  if (role === "DEVIATION" || role === "CALCULATED") {
    return "Calculates measurement deviation relative to nominal specification.";
  }
  if (role === "JUDGEMENT") {
    return "Evaluates acceptance criterion against calibration tolerances with safe blank propagation.";
  }

  return `Evaluates mathematical expression: ${formula}`;
}

/**
 * Primary translation function:
 * Converts Excel formulas into Gaugemaster semantic formulas.
 */
export function translateExcelFormula(
  excelFormula: string,
  tableColumns?: CanvasColumnDef[],
  targetColumn?: CanvasColumnDef
): ExcelTranslationResult {
  if (!excelFormula || typeof excelFormula !== "string") {
    return {
      translatedFormula: null,
      confidence: "LOW",
      reason: "No formula provided.",
      dependencies: [],
      originalFormula: "",
      isSupported: false,
      unsupportedFunctions: []
    };
  }

  const raw = excelFormula.trim();
  const clean = raw.startsWith("=") ? raw.slice(1).trim() : raw;
  const funcs = identifyExcelFunctions(clean);
  const unsupported = funcs.filter(f => !SUPPORTED_ENGINE_FUNCTIONS.has(f));

  const { readingVar, nominalVar, lowerLimitVar, upperLimitVar, averageVar, mpeVar, trialVars } = resolveCanonicalNames(tableColumns);
  const colRole = targetColumn?.role || targetColumn?.type;
  const colLabel = (targetColumn?.label || "").toLowerCase();

  // If there's an average column present and target column is deviation/error, use averageVar
  const hasAverageCol = Boolean(tableColumns?.some(c => /average|avg|mean/i.test(c.label || "") || /average|avg/i.test(c.id || "")));
  const effectiveReadingVar = (hasAverageCol && /error|deviation/i.test(colLabel)) ? averageVar : readingVar;

  // -------------------------------------------------------------
  // PATTERN 1: CHOOSE(ROW()-k, val1, val2, ...) row-offset nominal lookup
  // Example: =C-CHOOSE(ROW()-30,35.035,13,12,50,12,12,43.414,18,37)
  // or: =C31-CHOOSE(ROW()-30,...)
  // -------------------------------------------------------------
  const chooseRowRegex = /^(?:([A-Za-z]+[0-9]*)\s*-\s*)?CHOOSE\s*\(\s*ROW\s*\(\s*\)\s*-\s*\d+\s*,\s*[^)]+\)$/i;
  const chooseDeviationMatch = clean.match(chooseRowRegex);
  const containsChooseRowLookup = /CHOOSE\s*\(\s*ROW\s*\(\s*\)\s*-\s*\d+/i.test(clean);

  if (chooseDeviationMatch || containsChooseRowLookup) {
    const isSubtraction = clean.includes("-");
    if (isSubtraction || colLabel.includes("deviation") || colLabel.includes("error") || colRole === "CALCULATED") {
      const translated = `${effectiveReadingVar} - ${nominalVar}`;
      return {
        translatedFormula: translated,
        confidence: "HIGH",
        reason: "Excel row-based nominal lookup (CHOOSE(ROW()-k, ...)) translated to current-row normalized nominal metadata.",
        explanation: explainSemanticFormula(translated, "DEVIATION"),
        dependencies: [effectiveReadingVar, nominalVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: unsupported
      };
    } else {
      return {
        translatedFormula: nominalVar,
        confidence: "HIGH",
        reason: "Excel row-based nominal lookup translated to current-row nominal metadata.",
        explanation: `Reflects the nominal dimension for the current calibration point (${nominalVar}).`,
        dependencies: [nominalVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: unsupported
      };
    }
  }

  // -------------------------------------------------------------
  // PATTERN 2: INDEX(range, ROW()-k)
  // Example: =INDEX($B$5:$B$15, ROW()-4)
  // -------------------------------------------------------------
  const indexRowRegex = /^(?:([A-Za-z]+[0-9]*)\s*-\s*)?INDEX\s*\(\s*[^,]+\s*,\s*ROW\s*\(\s*\)\s*-\s*\d+\s*\)$/i;
  if (indexRowRegex.test(clean) || /INDEX\s*\([^,]+,\s*ROW\s*\(\s*\)/i.test(clean)) {
    const isSub = clean.includes("-");
    if (isSub || colLabel.includes("deviation") || colLabel.includes("error")) {
      const translated = `${effectiveReadingVar} - ${nominalVar}`;
      return {
        translatedFormula: translated,
        confidence: "HIGH",
        reason: "Excel row-based range lookup (INDEX(..., ROW()-k)) translated to current-row normalized nominal metadata.",
        explanation: explainSemanticFormula(translated, "DEVIATION"),
        dependencies: [effectiveReadingVar, nominalVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: unsupported
      };
    } else {
      return {
        translatedFormula: nominalVar,
        confidence: "HIGH",
        reason: "Excel INDEX row lookup translated to normalized nominal metadata.",
        explanation: `Reflects the nominal dimension (${nominalVar}).`,
        dependencies: [nominalVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: unsupported
      };
    }
  }

  // -------------------------------------------------------------
  // PATTERN 3: Simple Cell Differences: D31-C31, C31-B31, etc.
  // -------------------------------------------------------------
  const cellDiffRegex = /^=?\s*([A-Za-z]+)(\d+)\s*-\s*([A-Za-z]+)(\d+)\s*$/;
  const cellDiffMatch = clean.match(cellDiffRegex);
  if (cellDiffMatch) {
    const col1Letter = cellDiffMatch[1].toUpperCase();
    const row1 = cellDiffMatch[2];
    const col2Letter = cellDiffMatch[3].toUpperCase();
    const row2 = cellDiffMatch[4];

    if (row1 === row2 || colLabel.includes("deviation") || colLabel.includes("error")) {
      const translated = `${effectiveReadingVar} - ${nominalVar}`;
      return {
        translatedFormula: translated,
        confidence: "HIGH",
        reason: `Excel cell coordinate difference (${col1Letter}${row1} - ${col2Letter}${row2}) translated to row-independent semantic formula (${effectiveReadingVar} - ${nominalVar}).`,
        explanation: explainSemanticFormula(translated, "DEVIATION"),
        dependencies: [effectiveReadingVar, nominalVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: []
      };
    }
  }

  // -------------------------------------------------------------
  // PATTERN 4: Aggregations across cell ranges:
  // e.g. =AVERAGE(D31:H31), =MAX(D31:H31) - MIN(D31:H31)
  // -------------------------------------------------------------
  const rangeAverageRegex = /^AVERAGE\s*\(\s*([A-Za-z]+)(\d+)\s*:\s*([A-Za-z]+)(\d+)\s*\)$/i;
  const avgMatch = clean.match(rangeAverageRegex);
  if (avgMatch) {
    const colStart = avgMatch[1].toUpperCase().charCodeAt(0);
    const colEnd = avgMatch[3].toUpperCase().charCodeAt(0);
    const span = Math.abs(colEnd - colStart) + 1;

    let args: string[] = [];
    if (trialVars.length >= span) {
      args = trialVars.slice(0, span);
    } else {
      for (let i = 1; i <= Math.min(span, 10); i++) {
        args.push(`t${i}`);
      }
    }

    const translated = `AVERAGE(${args.join(", ")})`;
    return {
      translatedFormula: translated,
      confidence: "HIGH",
      reason: `Excel range aggregation translated to multi-trial observation variables (${args.join(", ")}).`,
      explanation: explainSemanticFormula(translated),
      dependencies: args,
      originalFormula: raw,
      isSupported: true,
      unsupportedFunctions: []
    };
  }

  const rangeSpreadRegex = /^MAX\s*\(\s*([A-Za-z]+)(\d+)\s*:\s*([A-Za-z]+)(\d+)\s*\)\s*-\s*MIN\s*\(\s*([A-Za-z]+)(\d+)\s*:\s*([A-Za-z]+)(\d+)\s*\)$/i;
  const spreadMatch = clean.match(rangeSpreadRegex);
  if (spreadMatch) {
    const colStart = spreadMatch[1].toUpperCase().charCodeAt(0);
    const colEnd = spreadMatch[3].toUpperCase().charCodeAt(0);
    const span = Math.abs(colEnd - colStart) + 1;

    let args: string[] = [];
    if (trialVars.length >= span) {
      args = trialVars.slice(0, span);
    } else {
      for (let i = 1; i <= Math.min(span, 10); i++) {
        args.push(`t${i}`);
      }
    }

    const argList = args.join(", ");
    const translated = `MAX(${argList}) - MIN(${argList})`;
    return {
      translatedFormula: translated,
      confidence: "HIGH",
      reason: `Excel MAX-MIN range calculation translated to multi-trial observation spread (${argList}).`,
      explanation: explainSemanticFormula(translated),
      dependencies: args,
      originalFormula: raw,
      isSupported: true,
      unsupportedFunctions: []
    };
  }

  // -------------------------------------------------------------
  // PATTERN 5: Judgement logic:
  // e.g. =IF(AND(D31>=B31, D31<=C31), "PASS", "FAIL")
  // or =IF(ABS(actual - nominal) <= mpe, "PASS", "FAIL")
  // -------------------------------------------------------------
  if (clean.toUpperCase().includes("PASS") && clean.toUpperCase().includes("FAIL")) {
    const hasMpeCheck = /mpe|permissible/i.test(clean) || Boolean(tableColumns?.some(c => /mpe/i.test(c.label || "") || /mpe/i.test(c.id || "")));
    if (hasMpeCheck) {
      const errCol = tableColumns?.find(c => /error|deviation/i.test(c.label || "") || /error|deviation/i.test(c.id || ""));
      const errVar = errCol ? errCol.id : "error";
      const translated = `IF(ISBLANK(${effectiveReadingVar}), "-", IF(ABS(${errVar}) <= ${mpeVar}, "PASS", "FAIL"))`;
      return {
        translatedFormula: translated,
        confidence: "HIGH",
        reason: "Excel conditional judgement formula translated to MPE acceptance comparison with safe blank handling.",
        explanation: explainSemanticFormula(translated, "JUDGEMENT"),
        dependencies: [effectiveReadingVar, errVar, mpeVar],
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: unsupported
      };
    }

    const translated = `IF(ISBLANK(${effectiveReadingVar}), "-", IF(AND(${effectiveReadingVar} >= ${lowerLimitVar}, ${effectiveReadingVar} <= ${upperLimitVar}), "PASS", "FAIL"))`;
    return {
      translatedFormula: translated,
      confidence: "HIGH",
      reason: "Excel conditional judgement formula translated to Gaugemaster calibration tolerance comparison with safe blank handling.",
      explanation: explainSemanticFormula(translated, "JUDGEMENT"),
      dependencies: [effectiveReadingVar, lowerLimitVar, upperLimitVar],
      originalFormula: raw,
      isSupported: true,
      unsupportedFunctions: unsupported
    };
  }

  // -------------------------------------------------------------
  // PATTERN 6: Formula is already valid in Gaugemaster engine or directly portable
  // -------------------------------------------------------------
  if (unsupported.length === 0) {
    const valResult = validateFormula(clean, tableColumns);
    if (valResult.isValid) {
      return {
        translatedFormula: clean,
        confidence: "HIGH",
        reason: "Formula syntax and functions are directly supported by Gaugemaster formula engine.",
        explanation: explainSemanticFormula(clean, colRole),
        dependencies: valResult.dependencies,
        originalFormula: raw,
        isSupported: true,
        unsupportedFunctions: []
      };
    }
  }

  // -------------------------------------------------------------
  // PATTERN 7: Unsupported function present without direct rule match
  // -------------------------------------------------------------
  if (unsupported.length > 0) {
    let suggestion: string | null = null;
    let reason = `Unsupported Excel function(s): ${unsupported.join(", ")}.`;

    if (unsupported.includes("CHOOSE") || unsupported.includes("ROW")) {
      suggestion = `${effectiveReadingVar} - ${nominalVar}`;
      reason = "CHOOSE/ROW were used for Excel row-offset specification lookup. Gaugemaster normalizes specifications per row, so actual_dimension - nominal should be used.";
    } else if (unsupported.includes("INDEX") || unsupported.includes("VLOOKUP") || unsupported.includes("XLOOKUP")) {
      suggestion = `${effectiveReadingVar} - ${nominalVar}`;
      reason = "Excel table lookup function translated to direct point specification comparison.";
    }

    return {
      translatedFormula: suggestion,
      confidence: suggestion ? "MEDIUM" : "LOW",
      reason,
      explanation: suggestion ? explainSemanticFormula(suggestion, colRole) : undefined,
      dependencies: suggestion ? [effectiveReadingVar, nominalVar] : [],
      originalFormula: raw,
      isSupported: false,
      unsupportedFunctions: unsupported
    };
  }

  // Fallback: Unknown formula pattern
  return {
    translatedFormula: null,
    confidence: "LOW",
    reason: "Formula pattern could not be translated deterministically. Manual review recommended.",
    dependencies: [],
    originalFormula: raw,
    isSupported: false,
    unsupportedFunctions: []
  };
}
