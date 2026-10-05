/**
 * Canonical Cell Value Resolution Engine
 *
 * Single source of truth for resolving cell values across calibration tables
 * (CanvasTemplateEditor, CertificatePreview, CalibrationWizard, etc.)
 *
 * Guaranteed Invariants:
 * 1. NEVER drops text: If a cell contains text (e.g. "Checked by GO Wear check Ring OK." or "M12x1.25 GO"),
 *    it is NEVER converted to undefined/blank, even if col.type is "reading" or "number".
 * 2. Status resolution: Resolves status/judgement across custom column IDs (e.g. "judgemet", "verdict")
 *    using fallback properties (row.status, row.judgement) before defaulting to "OK".
 *    NEVER evaluates the column ID itself as a formula.
 * 3. Nominal & Specification resolution: Safely reads nominal/spec from row[col.id], row.nominal_value,
 *    or row.nominal, avoiding 0 overrides when a specific nominal_value is present.
 */

export interface CellResolverColumn {
  id: string;
  type?: string;
  role?: string;
  label?: string;
  formula?: string;
  decimal_places?: number;
  decimalPrecision?: number;
  align?: string;
  [key: string]: any;
}

export interface CellResolverOptions {
  tableTolerance?: number;
  tableDecimals?: number;
  evalFormula?: (formula: string, row: any, tolerance: number, decimals: number) => any;
  rowIndex?: number;
}

/**
 * Resolves the display string for a single table cell given its row and column definitions.
 */
export function resolveCertificateCellValue(
  row: any,
  col: CellResolverColumn,
  options?: CellResolverOptions
): string {
  if (!row || !col) return "-";

  const rawCell = row[col.id];
  const colIdLower = String(col.id || "").toLowerCase().trim();
  const colType = String(col.type || "").toLowerCase().trim();
  const colRole = String(col.role || "").toUpperCase().trim();
  const colLabelLower = String(col.label || "").toLowerCase().trim();

  const colDec =
    col.decimal_places ??
    col.decimalPrecision ??
    (options?.tableDecimals !== undefined ? options.tableDecimals : 3);
  const tolerance = options?.tableTolerance ?? 0.02;

  // 1. Point Number / Serial No / Metadata
  const isPointNo =
    colIdLower === "point_number" ||
    colIdLower === "sl_no" ||
    colIdLower === "sino" ||
    colRole === "METADATA";

  if (isPointNo) {
    const pt =
      row.point_number ??
      row.sl_no ??
      rawCell ??
      (options?.rowIndex !== undefined ? options.rowIndex + 1 : undefined);
    return pt !== undefined && pt !== null && String(pt).trim() !== "" ? String(pt) : "-";
  }

  // 2. Status / Judgement
  const isStatusCol =
    colType === "status" ||
    colRole === "JUDGEMENT" ||
    /judg|verdict|status|decision|acceptance/i.test(colIdLower) ||
    /judg|verdict|status/i.test(colLabelLower);

  if (isStatusCol) {
    // 2a. Check if direct cell has non-empty value
    if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== "") {
      return String(rawCell).trim();
    }
    // 2b. Check row fallback status properties
    const fallbackStatus = row.judgement ?? row.status ?? row.verdict ?? row.result;
    if (fallbackStatus !== undefined && fallbackStatus !== null && String(fallbackStatus).trim() !== "") {
      return String(fallbackStatus).trim();
    }
    // 2c. If explicit formula exists, evaluate it
    if (
      col.formula &&
      typeof col.formula === "string" &&
      col.formula.trim().length > 0 &&
      options?.evalFormula
    ) {
      const formulaRes = options.evalFormula(col.formula, row, tolerance, colDec);
      if (formulaRes !== undefined && formulaRes !== null && String(formulaRes).trim() !== "") {
        return String(formulaRes).trim();
      }
    }
    // 2d. Default for status column
    return "OK";
  }

  // 3. Nominal Specification / Limits
  const isNominalCol =
    colType === "nominal" ||
    colRole === "SPECIFICATION" ||
    colIdLower === "nominal" ||
    colIdLower === "nom" ||
    colIdLower === "nominal_value" ||
    colIdLower === "std_spec" ||
    colIdLower === "std_value";

  if (isNominalCol) {
    const rawNom =
      rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== ""
        ? rawCell
        : row.nominal_value !== undefined && row.nominal_value !== null && String(row.nominal_value).trim() !== ""
        ? row.nominal_value
        : row.nominal !== undefined && row.nominal !== null && String(row.nominal).trim() !== "" && row.nominal !== 0 && row.nominal !== "0"
        ? row.nominal
        : row.nom ?? row.std_spec ?? row.std_value ?? row.nominal;

    if (rawNom !== undefined && rawNom !== null && String(rawNom).trim() !== "" && rawNom !== "-") {
      const strNom = String(rawNom).trim();
      const p = parseFloat(strNom);
      if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strNom)) {
        return colDec === 0 ? String(Math.round(p)) : p.toFixed(colDec);
      }
      return strNom;
    }
    return "-";
  }

  // 4. Specification / Required Dimension / Description Text
  const isSpecCol =
    colType === "text" ||
    colIdLower === "required_dimension" ||
    colIdLower === "specification" ||
    colIdLower === "description" ||
    /spec|dimension/i.test(colLabelLower);

  if (isSpecCol) {
    const textVal =
      rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== ""
        ? rawCell
        : row.required_dimension || row.specification || row.description;
    if (textVal !== undefined && textVal !== null && String(textVal).trim() !== "") {
      return String(textVal);
    }
    if (colType === "text") return "-";
  }

  // 5. Formula Column (only if explicit formula is provided or type === 'formula')
  const hasFormula =
    colType === "formula" ||
    (typeof col.formula === "string" && col.formula.trim().length > 0);

  if (hasFormula) {
    if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== "") {
      const strCell = String(rawCell).trim();
      const p = parseFloat(strCell);
      if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strCell)) {
        return colDec === 0 ? String(Math.round(p)) : p.toFixed(colDec);
      }
      return strCell;
    }
    if (col.formula && typeof col.formula === "string" && col.formula.trim().length > 0 && options?.evalFormula) {
      const formulaRes = options.evalFormula(col.formula, row, tolerance, colDec);
      if (formulaRes !== undefined && formulaRes !== null && String(formulaRes).trim() !== "") {
        return String(formulaRes).trim();
      }
    }
    return "-";
  }

  // 6. General Cell Value (Readings, Trials, Numbers, Custom Text)
  if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== "") {
    const strVal = String(rawCell).trim();
    if (strVal === "-") return "-";

    // Format clean numbers with column decimal places
    const p = parseFloat(strVal);
    if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strVal)) {
      return colDec === 0 ? String(Math.round(p)) : p.toFixed(colDec);
    }
    // CRITICAL: If text or non-numeric string, return as-is! NEVER DROP!
    return strVal;
  }

  // Fallbacks for well-known aliases when rawCell is empty
  if (colIdLower.includes("actual") && row.actual_dimension) return String(row.actual_dimension);
  if (colIdLower.includes("required") && row.required_dimension) return String(row.required_dimension);

  return "-";
}
