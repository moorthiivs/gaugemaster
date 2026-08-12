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

/**
 * Validates formula expression syntax using HyperFormula parser engine.
 */
export function validateFormulaSyntax(formulaStr: string): { valid: boolean; message?: string } {
  if (!formulaStr || !formulaStr.trim()) return { valid: true };
  let expr = formulaStr.trim();
  if (!expr.startsWith("=")) expr = "=" + expr;

  // Replace variable names, macros, and Excel letters (A..Z, AA..AZ) with dummy value 1 for parsing
  const testExpr = expr
    .replace(/(MIN_VAL|MAX_VAL|NOMINAL)\([a-zA-Z]+\)/gi, "1")
    .replace(/\b[A-Z]{1,2}\b/gi, "1")
    .replace(/\b(Nominal|Actual|Ascending|Descending|Error|Tolerance|STD|DUC|AcceptanceCriteria|MPE|Limit|AC)\b/gi, "1");

  try {
    const hf = HyperFormula.buildFromArray([[1]], { licenseKey: "gpl-v3" });
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
 * Reusable HyperFormula evaluation engine.
 * Computes formulas using Excel Column Letters (A, B, C, D... AA, AB) or Column Names:
 * - `=A - B`
 * - `=(A - B) / B * 100`
 * - `=(Actual - Nominal) / Nominal * 100`
 * - `=AVERAGE(A, B)`
 * - `=ABS(A - B)`
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

    // Raw values map for MIN_VAL/MAX_VAL macros
    const rawValuesMap: Record<string, any> = {
      Nominal: pt.nominal,
      STD: pt.nominal,
      Tolerance: pt.tolerance,
      Actual: pt.ascending_reading,
      Ascending: pt.ascending_reading,
      Descending: pt.descending_reading,
      Error: pt.error,
      AcceptanceCriteria: acceptanceCriteriaValue,
      MPE: acceptanceCriteriaValue,
      Limit: acceptanceCriteriaValue,
      AC: acceptanceCriteriaValue,
    };

    // Standard named variables map
    const valuesMap: Record<string, number> = {
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

    // Filter out 'pt' and 'actions' so Excel letters (A, B, C, D...) start at the 1st actual data column
    const dataColumns = activeColumnOrder.filter((k) => k !== "pt" && k !== "actions");

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

    dataColumns.forEach((colKey, colIdx) => {
      const excelLetter = getExcelColumnLetter(colIdx);
      let colVal = 0;
      let rawVal: any = 0;

      if (colKey === "description") { colVal = parseNum(pt.description); rawVal = pt.description; }
      else if (colKey === "nominal") { colVal = nom; rawVal = pt.nominal; }
      else if (colKey === "tolerance") { colVal = tol; rawVal = pt.tolerance; }
      else if (colKey === "ascending_reading") { colVal = asc; rawVal = pt.ascending_reading; }
      else if (colKey === "descending_reading") { colVal = desc || 0; rawVal = pt.descending_reading; }
      else if (colKey === "error") { colVal = err; rawVal = pt.error; }
      else if (colKey === "status") { colVal = 0; rawVal = 0; }
      else {
        // Custom column lookup by ID and Name
        const customCol = customColumns.find((c) => c.id === colKey);
        rawVal = getCustomFieldValue(colKey, customCol?.name);
        colVal = parseNum(rawVal);
      }

      valuesMap[excelLetter] = colVal;
      rawValuesMap[excelLetter] = rawVal;
    });

    // Custom Column Name mappings
    customColumns.forEach((c) => {
      const rawVal = getCustomFieldValue(c.id, c.name);
      const val = parseNum(rawVal);

      if (c.name && c.name.trim()) {
        valuesMap[c.name.trim()] = val;
        rawValuesMap[c.name.trim()] = rawVal;
      }
    });

    // Sort variables by length descending to prevent partial replacements (e.g. replacing 'C' inside 'AcceptanceCriteria')
    const sortedKeys = Object.keys(valuesMap).sort((a, b) => b.length - a.length);

    let processedExpr = expr;

    // 1. Evaluate macros like MIN_VAL(C), MAX_VAL(C), NOMINAL(C)
    const macroRegex = /(MIN_VAL|MAX_VAL|NOMINAL)\(([a-zA-Z0-9_]+)\)/gi;
    processedExpr = processedExpr.replace(macroRegex, (match, func, colName) => {
      // Find the raw value for this column (case-insensitive fallback)
      let raw = rawValuesMap[colName] ?? rawValuesMap[colName.toUpperCase()];
      if (raw === undefined) {
        // Check custom columns matched by name instead of excel letter
        const matchKey = Object.keys(rawValuesMap).find((k) => k.toLowerCase() === colName.toLowerCase());
        if (matchKey) raw = rawValuesMap[matchKey];
      }
      
      const bounds = extractBounds(raw);
      const funcUpper = func.toUpperCase();
      if (funcUpper === "MIN_VAL") return String(bounds.min);
      if (funcUpper === "MAX_VAL") return String(bounds.max);
      return String(bounds.nom);
    });

    // 2. Replace standard named variables and Excel letters
    sortedKeys.forEach((key) => {
      const val = valuesMap[key];
      const rawVal = rawValuesMap[key];
      let replaceVal = String(val);
      // If raw value is a non-numeric text string (e.g. "OK"), format as a quoted string literal so text comparisons like =C="OK" work
      if (typeof rawVal === "string" && isNaN(Number(rawVal.trim())) && rawVal.trim() !== "") {
        replaceVal = JSON.stringify(rawVal);
      }
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      processedExpr = processedExpr.replace(regex, replaceVal);
    });

    // HyperFormula evaluation
    const hf = HyperFormula.buildFromArray([[0]], { licenseKey: "gpl-v3" });
    hf.setCellContents({ sheet: 0, col: 0, row: 0 }, [[processedExpr]]);
    const res = hf.getCellValue({ sheet: 0, col: 0, row: 0 });

    if (res === null || res === undefined) return "-";
    if (typeof res === "boolean") return res ? "TRUE" : "FALSE";
    if (typeof res === "object" && "type" in res) {
      return `#${(res as any).type}`;
    }
    if (typeof res === "number") {
      if (isNaN(res)) return "Err";
      if (!isFinite(res)) return "Div/0";
      return col.formulaType === "pct_error" || expr.includes("*100") || expr.includes("* 100")
        ? `${res.toFixed(3)}%`
        : parseFloat(res.toFixed(4)).toString();
    }
    return String(res);
  } catch {
    return "Err";
  }
}
