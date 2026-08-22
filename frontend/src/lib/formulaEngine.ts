import { HyperFormula } from "hyperformula";
import { CalibrationPoint } from "@/types/calibration";

export interface CustomColumn {
  id: string;
  name: string;
  type: "text" | "number" | "formula";
  formulaType?: "avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom";
  customFormula?: string;
  unit?: string;
  decimalPlaces?: number;
  groupName?: string;
}

export interface VariableSuggestion {
  label: string;
  value: string;
  description: string;
}

/**
 * Predefined standard clickable variable tokens for formulas.
 */
export const FORMULA_VARIABLE_SUGGESTIONS: VariableSuggestion[] = [
  { label: "Nominal", value: "Nominal", description: "Nominal value (Standard)" },
  { label: "Actual", value: "Actual", description: "Actual / Observed reading" },
  { label: "Ascending", value: "Ascending", description: "Ascending reading" },
  { label: "Descending", value: "Descending", description: "Descending reading" },
  { label: "Error", value: "Error", description: "Calculated error (Actual - Nominal)" },
  { label: "Tolerance", value: "Tolerance", description: "Row tolerance limit (±)" },
  { label: "Accept. Criteria", value: "MPE", description: "Global template acceptance criteria limit (Alias: MPE, Limit, AC, AcceptanceCriteria)" },
];

/**
 * Converts 0-indexed column position to Excel Column Letter(s):
 * 0 -> A, 1 -> B, 2 -> C ... 25 -> Z, 26 -> AA, 27 -> AB
 */
export function getExcelColumnLetter(index: number): string {
  if (index < 0) return "";
  let letter = "";
  let temp = index;

  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function extractBounds(val: any): { min: number; max: number; nom: number } {
  if (typeof val === "number") return { min: val, max: val, nom: val };
  if (!val) return { min: 0, max: 0, nom: 0 };
  const str = String(val).trim();
  
  // Match ± format: "35.990±0.002" or "35.990 ± 0.002"
  const pmMatch = str.match(/^(-?[\d.]+)\s*±\s*([\d.]+)$/);
  if (pmMatch) {
    const nom = parseFloat(pmMatch[1]);
    const tol = parseFloat(pmMatch[2]);
    return { min: nom - tol, max: nom + tol, nom };
  }

  // Match + / - format: "35.990 +0.002 / -0.001"
  const diffMatch = str.match(/^(-?[\d.]+)\s*\+\s*([\d.]+)\s*[\/\\]?\s*-\s*([\d.]+)$/);
  if (diffMatch) {
    const nom = parseFloat(diffMatch[1]);
    const plus = parseFloat(diffMatch[2]);
    const minus = parseFloat(diffMatch[3]);
    return { min: nom - minus, max: nom + plus, nom };
  }
  
  const nom = parseFloat(str);
  return { min: isNaN(nom) ? 0 : nom, max: isNaN(nom) ? 0 : nom, nom: isNaN(nom) ? 0 : nom };
}

const parseNum = (val: any): number => {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
};

// Singleton HyperFormula instance - initialized once, reused forever to eliminate massive memory/CPU lag
let sharedHfInstance: HyperFormula | null = null;
function getSharedHyperFormula(): HyperFormula {
  if (!sharedHfInstance) {
    sharedHfInstance = HyperFormula.buildFromArray([[0]], { licenseKey: "gpl-v3" });
  }
  return sharedHfInstance;
}

/**
 * Validates formula expression syntax using HyperFormula parser engine.
 */
export function validateFormulaSyntax(formulaStr: string): { valid: boolean; message?: string } {
  if (!formulaStr || !formulaStr.trim()) return { valid: true };
  let expr = formulaStr.trim();
  if (!expr.startsWith("=")) expr = "=" + expr;

  // Replace variable names, brackets, macros, and Excel letters (A..Z, AA..AZ) with dummy value 1 for parsing
  const testExpr = expr
    .replace(/\[[^\]]+\]/g, "1")
    .replace(/(MIN_VAL|MAX_VAL|NOMINAL)\([a-zA-Z0-9_]+\)/gi, "1")
    .replace(/\b[A-Z]{1,2}\b/gi, "1")
    .replace(/\b(Nominal|Actual|Ascending|Descending|Error|Tolerance|STD|DUC|AcceptanceCriteria|MPE|Limit|AC)\b/gi, "1");

  try {
    const hf = getSharedHyperFormula();
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[testExpr]]);
    const res = hf.getCellValue({ sheet: 0, col: 0, row: 0 });

    if (typeof res === "object" && res !== null && "type" in res) {
      const errType = (res as any).type;
      if (errType === "ERROR" || errType === "PARSE" || errType === "VALUE" || errType === "NAME") {
        return { valid: false, message: "Formula syntax warning: Check operators (+, -, *, /) or matching parentheses ()" };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, message: "Invalid formula expression syntax" };
  }
}

/**
 * Ultra-fast micro-evaluator for spreadsheet math and logic expressions.
 * Computes common functions in microseconds without overhead.
 */
function fastEvaluateMathAndLogic(expr: string): { success: boolean; result?: any } {
  let clean = expr.trim();
  if (clean.startsWith("=")) clean = clean.substring(1).trim();

  // Recursive parsing of standard spreadsheet functions
  let maxDepth = 25;
  let prev = "";
  while (prev !== clean && maxDepth-- > 0) {
    prev = clean;

    // AVERAGE / AVG
    clean = clean.replace(/\b(?:AVERAGE|AVG)\s*\(([^()]+)\)/gi, (_, argsStr) => {
      const nums = argsStr.split(",").map((a: string) => parseFloat(a.trim())).filter((n: number) => !isNaN(n));
      if (nums.length === 0) return "0";
      const avg = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
      return String(avg);
    });

    // SUM
    clean = clean.replace(/\bSUM\s*\(([^()]+)\)/gi, (_, argsStr) => {
      const nums = argsStr.split(",").map((a: string) => parseFloat(a.trim())).filter((n: number) => !isNaN(n));
      return String(nums.reduce((a: number, b: number) => a + b, 0));
    });

    // ABS
    clean = clean.replace(/\bABS\s*\(([^()]+)\)/gi, (_, arg) => {
      const num = parseFloat(arg.trim());
      return String(isNaN(num) ? 0 : Math.abs(num));
    });

    // SQRT
    clean = clean.replace(/\bSQRT\s*\(([^()]+)\)/gi, (_, arg) => {
      const num = parseFloat(arg.trim());
      return String(isNaN(num) || num < 0 ? 0 : Math.sqrt(num));
    });

    // ROUND(val, dec)
    clean = clean.replace(/\bROUND\s*\(([^,]+),([^()]+)\)/gi, (_, valStr, decStr) => {
      const num = parseFloat(valStr.trim());
      const dec = parseInt(decStr.trim(), 10) || 0;
      return isNaN(num) ? "0" : num.toFixed(dec);
    });

    // MIN / MAX
    clean = clean.replace(/\bMIN\s*\(([^()]+)\)/gi, (_, argsStr) => {
      const nums = argsStr.split(",").map((a: string) => parseFloat(a.trim())).filter((n: number) => !isNaN(n));
      return String(nums.length ? Math.min(...nums) : 0);
    });
    clean = clean.replace(/\bMAX\s*\(([^()]+)\)/gi, (_, argsStr) => {
      const nums = argsStr.split(",").map((a: string) => parseFloat(a.trim())).filter((n: number) => !isNaN(n));
      return String(nums.length ? Math.max(...nums) : 0);
    });

    // STDEV / STDEVP
    clean = clean.replace(/\bSTDEV(?:P)?\s*\(([^()]+)\)/gi, (_, argsStr) => {
      const nums = argsStr.split(",").map((a: string) => parseFloat(a.trim())).filter((n: number) => !isNaN(n));
      if (nums.length <= 1) return "0";
      const mean = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
      const variance = nums.reduce((acc: number, curr: number) => acc + Math.pow(curr - mean, 2), 0) / (nums.length - 1);
      return String(Math.sqrt(variance));
    });

    // IF(condition, trueVal, falseVal)
    clean = clean.replace(/\bIF\s*\(([^,]+),([^,]+),([^()]+)\)/gi, (_, cond, tVal, fVal) => {
      let c = cond.trim()
        .replace(/<>/g, " !== ")
        .replace(/<=/g, " <= ")
        .replace(/>=/g, " >= ")
        .replace(/(?<![<>=!])=(?![=])/g, " === ");

      try {
        const isTrue = Boolean(Function(`"use strict"; return (${c});`)());
        return isTrue ? tVal.trim() : fVal.trim();
      } catch {
        return fVal.trim();
      }
    });
  }

  // Evaluate arithmetic and logic expression
  try {
    const sanitized = clean
      .replace(/<>/g, " !== ")
      .replace(/<=/g, " <= ")
      .replace(/>=/g, " >= ")
      .replace(/(?<![<>=!])=(?![=])/g, " === ")
      .replace(/\^/g, "**");

    const evalResult = Function(`"use strict"; return (${sanitized});`)();
    return { success: true, result: evalResult };
  } catch {
    return { success: false };
  }
}

/**
 * Reusable, High-Performance Formula Evaluation Engine.
 * Computes formulas using Excel Column Letters, Custom Column IDs, Column Names, and Standard Variables.
 * Automatically resolves aliases, executes in microseconds, and avoids #NAME/#VALUE errors.
 */
export function evaluateFormulaValue(
  col: CustomColumn,
  pt: CalibrationPoint,
  hasDescending: boolean = false,
  customColumns: CustomColumn[] = [],
  activeColumnOrder: string[] = [],
  defaultTolerance: number = 0,
  acceptanceCriteriaValue: number = 0
): string {
  const nom = parseNum(pt.nominal);
  const asc = parseNum(pt.ascending_reading);
  const desc = pt.descending_reading !== undefined ? parseNum(pt.descending_reading) : undefined;
  const actual = desc !== undefined ? (asc + desc) / 2 : asc;
  const err = pt.error ?? (actual - nom);
  const tol = pt.tolerance !== undefined && pt.tolerance > 0 ? parseNum(pt.tolerance) : parseNum(defaultTolerance);

  let formulaExpr = "";

  switch (col.formulaType) {
    case "avg":
      formulaExpr = "=AVERAGE(Nominal, Actual)";
      break;
    case "stddev":
      formulaExpr = desc !== undefined ? "=STDEV(Ascending, Descending)" : "=0";
      break;
    case "pct_error":
      formulaExpr = "=((Actual - Nominal) / Nominal) * 100";
      break;
    case "abs_error":
      formulaExpr = "=ABS(Actual - Nominal)";
      break;
    case "bias":
      formulaExpr = "=Actual - Nominal";
      break;
    case "custom":
      formulaExpr = col.customFormula || "=Actual - Nominal";
      break;
    default:
      return "-";
  }

  try {
    let expr = formulaExpr.trim();
    if (!expr.startsWith("=")) {
      expr = "=" + expr;
    }

    // Raw values map for bounds extraction and macro evaluation
    const rawValuesMap: Record<string, any> = {
      Nominal: pt.nominal,
      STD: pt.nominal,
      Tolerance: pt.tolerance ?? tol,
      Actual: pt.ascending_reading,
      Ascending: pt.ascending_reading,
      Descending: pt.descending_reading,
      Error: pt.error ?? err,
      AcceptanceCriteria: acceptanceCriteriaValue,
      MPE: acceptanceCriteriaValue,
      Limit: acceptanceCriteriaValue,
      AC: acceptanceCriteriaValue,
    };

    // Standard named variables map (Numeric values)
    const valuesMap: Record<string, number | string> = {
      Nominal: nom,
      STD: nom,
      Tolerance: tol,
      Actual: actual,
      Ascending: asc,
      Descending: desc || 0,
      Error: err,
      AcceptanceCriteria: parseNum(acceptanceCriteriaValue),
      MPE: parseNum(acceptanceCriteriaValue),
      Limit: parseNum(acceptanceCriteriaValue),
      AC: parseNum(acceptanceCriteriaValue),
    };

    // Helper to fetch custom field value from point
    const getCustomFieldValue = (colId: string, colName?: string) => {
      if (!pt.customFields) return undefined;
      let raw = pt.customFields[colId];
      if (raw === undefined && colName) {
        raw = pt.customFields[colName];
      }
      if (raw === undefined) {
        const targetKeys = [colId.toLowerCase(), colName?.toLowerCase()].filter(Boolean);
        const matchedKey = Object.keys(pt.customFields).find((k) =>
          targetKeys.includes(k.toLowerCase())
        );
        if (matchedKey) raw = pt.customFields[matchedKey];
      }
      if (typeof raw === "object" && raw !== null && "value" in raw) {
        return (raw as any).value;
      }
      return raw;
    };

    // Register all Custom Columns by ID and Name
    customColumns.forEach((c) => {
      const rawVal = getCustomFieldValue(c.id, c.name);
      const isActuallyNumeric = typeof rawVal === "number" || (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal.trim())) && isFinite(Number(rawVal.trim())));
      const val = isActuallyNumeric ? parseNum(rawVal) : (rawVal ?? "");

      // Map by column ID (e.g. col_r1, col_avg, col_error, col_judge)
      valuesMap[c.id] = val;
      rawValuesMap[c.id] = rawVal;
      valuesMap[c.id.toLowerCase()] = val;
      valuesMap[c.id.toUpperCase()] = val;

      // Map by column name (e.g. "1", "2", "Avg", "Reading 1")
      if (c.name && c.name.trim()) {
        const nameTrimmed = c.name.trim();
        valuesMap[nameTrimmed] = val;
        rawValuesMap[nameTrimmed] = rawVal;
        valuesMap[`[${nameTrimmed}]`] = val;
      }
    });

    // Map Excel Column Letters (A, B, C, D... AA, AB) based on active data column order
    const dataColumns = activeColumnOrder.filter((k) => k !== "pt" && k !== "actions");
    dataColumns.forEach((colKey, colIdx) => {
      const excelLetter = getExcelColumnLetter(colIdx);
      if (!excelLetter) return;

      let colVal: any = 0;
      let rawVal: any = 0;

      if (colKey === "description") { colVal = pt.description || ""; rawVal = pt.description; }
      else if (colKey === "nominal") { colVal = nom; rawVal = pt.nominal; }
      else if (colKey === "tolerance") { colVal = tol; rawVal = pt.tolerance; }
      else if (colKey === "ascending_reading") { colVal = asc; rawVal = pt.ascending_reading; }
      else if (colKey === "descending_reading") { colVal = desc || 0; rawVal = pt.descending_reading; }
      else if (colKey === "error") { colVal = err; rawVal = pt.error; }
      else if (colKey === "status") { colVal = pt.status || ""; rawVal = pt.status; }
      else {
        const customCol = customColumns.find((c) => c.id === colKey);
        rawVal = getCustomFieldValue(colKey, customCol?.name);
        colVal = parseNum(rawVal);
      }

      valuesMap[excelLetter] = colVal;
      rawValuesMap[excelLetter] = rawVal;
    });

    let processedExpr = expr;

    // 1. Bracketed column references: [1], [Reading 1], [Avg], [Error]
    processedExpr = processedExpr.replace(/\[([^\]]+)\]/g, (match, colName) => {
      const trimmed = colName.trim();
      if (valuesMap[trimmed] !== undefined) {
        const val = valuesMap[trimmed];
        return typeof val === "string" && isNaN(Number(val)) ? JSON.stringify(val) : String(val);
      }
      return match;
    });

    // 2. Evaluate macros like MIN_VAL(C), MAX_VAL(C), NOMINAL(C)
    const macroRegex = /(MIN_VAL|MAX_VAL|NOMINAL)\(([^()]+)\)/gi;
    processedExpr = processedExpr.replace(macroRegex, (match, func, colName) => {
      const trimmed = colName.trim();
      let raw = rawValuesMap[trimmed] ?? rawValuesMap[trimmed.toUpperCase()];
      if (raw === undefined) {
        const matchKey = Object.keys(rawValuesMap).find((k) => k.toLowerCase() === trimmed.toLowerCase());
        if (matchKey) raw = rawValuesMap[matchKey];
      }
      
      const bounds = extractBounds(raw);
      const funcUpper = func.toUpperCase();
      if (funcUpper === "MIN_VAL") return String(bounds.min);
      if (funcUpper === "MAX_VAL") return String(bounds.max);
      return String(bounds.nom);
    });

    // 3. Replace known variables, column IDs, Excel letters, and standard tokens
    // Sort keys by length descending to prevent partial match collisions (e.g. 'C' inside 'AcceptanceCriteria')
    const sortedKeys = Object.keys(valuesMap).sort((a, b) => b.length - a.length);

    sortedKeys.forEach((key) => {
      if (key.startsWith("[") && key.endsWith("]")) return; // already handled
      const val = valuesMap[key];
      const rawVal = rawValuesMap[key];
      let replaceVal = String(val);

      if (typeof rawVal === "string" && isNaN(Number(rawVal.trim())) && rawVal.trim() !== "") {
        replaceVal = JSON.stringify(rawVal);
      }

      // If key is a pure digit (e.g. "1", "2" for column headers named 1, 2, 3), only replace when enclosed in function args
      if (/^\d+$/.test(key)) {
        const digitArgRegex = new RegExp(`(?<=[(, ])\\b${key}\\b(?=[), ])`, "g");
        processedExpr = processedExpr.replace(digitArgRegex, replaceVal);
      } else {
        const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        processedExpr = processedExpr.replace(regex, replaceVal);
      }
    });

    // 4. Try fast micro-evaluator first (0.01ms execution)
    const fastRes = fastEvaluateMathAndLogic(processedExpr);
    if (fastRes.success) {
      const res = fastRes.result;
      if (res === null || res === undefined) return "-";
      if (typeof res === "boolean") return res ? "PASS" : "FAIL";
      if (typeof res === "number") {
        if (isNaN(res)) return "Err";
        if (!isFinite(res)) return "Div/0";
        if (col.formulaType === "pct_error" || expr.includes("*100") || expr.includes("* 100")) {
          return `${res.toFixed(3)}%`;
        }
        const dec = col.decimalPlaces !== undefined && col.decimalPlaces >= 0 ? col.decimalPlaces : 4;
        return dec === 0 ? String(Math.round(res)) : parseFloat(res.toFixed(dec)).toString();
      }
      return String(res);
    }

    // 5. Fallback to singleton HyperFormula instance for advanced Excel functions
    const hf = getSharedHyperFormula();
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[processedExpr]]);
    const res = hf.getCellValue({ sheet: 0, col: 0, row: 0 });

    if (res === null || res === undefined) return "-";
    if (typeof res === "boolean") return res ? "PASS" : "FAIL";
    if (typeof res === "object" && "type" in res) {
      return `#${(res as any).type}`;
    }
    if (typeof res === "number") {
      if (isNaN(res)) return "Err";
      if (!isFinite(res)) return "Div/0";
      if (col.formulaType === "pct_error" || expr.includes("*100") || expr.includes("* 100")) {
        return `${res.toFixed(3)}%`;
      }
      const dec = col.decimalPlaces !== undefined && col.decimalPlaces >= 0 ? col.decimalPlaces : 4;
      return dec === 0 ? String(Math.round(res)) : parseFloat(res.toFixed(dec)).toString();
    }
    return String(res);
  } catch {
    return "Err";
  }
}
