import {
  CanvasBlock,
  TableGridBlock,
  SplitRowBlock,
  CanvasColumnDef,
  CanvasRowData,
} from "@/types/template";
import { evaluateCanvasRowFormulas } from "@/lib/formulaEngine";
import { parseSpecification } from "@/lib/specificationParser";

export interface PasteValuesOptions {
  rows: CanvasRowData[];
  columns: CanvasColumnDef[];
  colId: string;
  startRowIndex: number;
  clipboardText: string;
  unit?: string;
  defaultTolerance?: number;
  decimalPlaces?: number;
  autoExpand?: boolean;
  tableNominal?: number | string;
}

export interface PasteResult {
  updatedRows: CanvasRowData[];
  pastedCount: number;
  addedRowCount: number;
}

/**
 * Parses raw clipboard text (e.g. copied from Excel, Sheets, CSV, or multiline text)
 * into a clean array of values.
 */
export function parseClipboardValues(text: string): string[] {
  if (!text) return [];

  // Split lines on CRLF or LF
  const rawLines = text.split(/\r\n|\r|\n/);

  const values: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();

    // Excel copies may wrap cell values in quotes
    if (line.startsWith('"') && line.endsWith('"')) {
      line = line.substring(1, line.length - 1).trim();
    }

    // If copied multiple columns, take the first column value
    if (line.includes("\t")) {
      const parts = line.split("\t");
      line = parts[0]?.trim() || "";
    }

    if (line.startsWith('"') && line.endsWith('"')) {
      line = line.substring(1, line.length - 1).trim();
    }

    // Ignore trailing empty line commonly added by Excel/clipboard
    if (i === rawLines.length - 1 && line === "") {
      continue;
    }

    values.push(line);
  }

  return values;
}

/**
 * Applies an array of pasted values down a specific column starting from startRowIndex.
 * Preserves all other columns, headers, formulas, and auto-recalculates dependent formula values.
 */
export function applyPastedValuesToRows(options: PasteValuesOptions): PasteResult {
  const {
    rows,
    columns,
    colId,
    startRowIndex,
    clipboardText,
    unit = "mm",
    defaultTolerance = 0.01,
    decimalPlaces = 3,
    autoExpand = true,
    tableNominal,
  } = options;

  const values = parseClipboardValues(clipboardText);
  if (values.length === 0) {
    return { updatedRows: rows, pastedCount: 0, addedRowCount: 0 };
  }

  const updatedRows: CanvasRowData[] = rows.map((r) => ({ ...r }));
  const tol = defaultTolerance;
  const dec = decimalPlaces;
  let addedRowCount = 0;

  const targetCol = columns.find((c) => c.id === colId);
  const colType = targetCol?.type;

  const trialMatch = colId.match(
    /^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i
  );

  for (let i = 0; i < values.length; i++) {
    const targetIdx = startRowIndex + i;
    const rawVal = values[i];
    const parsedNum = parseFloat(rawVal);
    const numVal = !isNaN(parsedNum) ? parsedNum : undefined;

    let targetRow: CanvasRowData;
    if (targetIdx < updatedRows.length) {
      targetRow = { ...updatedRows[targetIdx] };
    } else if (autoExpand) {
      // Auto-expand row: ensure numeric point_number calculation (preventing "1" + 1 === "11" bug)
      const prevPointVal = updatedRows.length > 0
        ? updatedRows[updatedRows.length - 1].point_number
        : 0;
      const parsedPrev = parseInt(String(prevPointVal || updatedRows.length), 10);
      const nextPointNumber = (!isNaN(parsedPrev) ? parsedPrev : updatedRows.length) + 1;

      targetRow = {
        point_number: nextPointNumber,
        unit,
        tolerance: tol,
      };
      addedRowCount++;
    } else {
      break;
    }

    // Skip merged statement rows from receiving numeric values
    if (targetRow.is_merged || targetRow.isMerged) {
      continue;
    }

    // Set value on target column
    targetRow[colId] = rawVal;

    // Set canonical properties based on colId or column type
    if (colId === "reading" || colType === "reading") {
      targetRow.reading = numVal;
      targetRow[colId] = rawVal;
    } else if (
      colId === "nominal" ||
      colType === "nominal" ||
      colId === "required_dimension" ||
      colId === "specification" ||
      /spec|nominal|dimension/i.test(colId)
    ) {
      targetRow.nominal = numVal;
      targetRow[colId] = rawVal;
    } else if (colId === "tolerance" || colType === "tolerance") {
      targetRow.tolerance = numVal;
      targetRow[colId] = rawVal;
    } else if (colId === "description" || colType === "text") {
      targetRow.description = rawVal;
      targetRow[colId] = rawVal;
    }

    // If column represents trials, populate aliases
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        targetRow[a] = rawVal;
      });
    }

    // Specification parsing for nominal/spec columns
    if (
      colId === "required_dimension" ||
      colId === "specification" ||
      colId === "description" ||
      colId === "nominal" ||
      /spec|dimension/i.test(colId)
    ) {
      const parsedSpec = parseSpecification(rawVal, unit, tol, dec);
      if (parsedSpec.isValid) {
        targetRow.nominal = parsedSpec.nominal;
        targetRow.lower_tolerance = parsedSpec.lowerTolerance;
        targetRow.upper_tolerance = parsedSpec.upperTolerance;
        targetRow.lowerTolerance = parsedSpec.lowerTolerance;
        targetRow.upperTolerance = parsedSpec.upperTolerance;
        targetRow.lower_limit = parsedSpec.lowerLimit;
        targetRow.upper_limit = parsedSpec.upperLimit;
        targetRow.lowerLimit = parsedSpec.lowerLimit;
        targetRow.upperLimit = parsedSpec.upperLimit;
      }
    }

    // Re-evaluate formulas (e.g. error = reading - nominal, Judgement = PASS/FAIL)
    const evaluated = evaluateCanvasRowFormulas(targetRow, columns, tol, dec, tableNominal);
    evaluated[colId] = rawVal;

    if (colId === "nominal" || colType === "nominal") {
      evaluated.nominal = numVal;
      evaluated[colId] = rawVal;
    }
    if (colId === "reading" || colType === "reading") {
      evaluated.reading = numVal;
      evaluated[colId] = rawVal;
    }

    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        evaluated[a] = rawVal;
      });
    }

    if (targetIdx < updatedRows.length) {
      updatedRows[targetIdx] = evaluated;
    } else {
      updatedRows.push(evaluated);
    }
  }

  return {
    updatedRows,
    pastedCount: values.length,
    addedRowCount,
  };
}

/**
 * Copies all row values for a specific column to system clipboard as clean newline-separated text.
 * Includes automatic fallback for browsers where navigator.clipboard is restricted.
 */
export async function copyColumnValuesToClipboard(
  rows: CanvasRowData[],
  colId: string
): Promise<{ success: boolean; count: number; text: string }> {
  try {
    const values = rows
      .filter((r) => !r.is_merged && !r.isMerged)
      .map((r) => {
        if (r[colId] !== undefined && r[colId] !== null) return String(r[colId]);
        if (colId === "nominal" && r.nominal !== undefined) return String(r.nominal);
        if (colId === "reading" && r.reading !== undefined) return String(r.reading);
        if (colId === "description" && r.description !== undefined) return String(r.description);
        if (colId === "point_number" && r.point_number !== undefined) return String(r.point_number);
        if (colId === "tolerance" && r.tolerance !== undefined) return String(r.tolerance);
        return "";
      });

    const textToCopy = values.join("\n");
    let copied = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch (e) {
        console.warn("navigator.clipboard.writeText failed, falling back to document.execCommand", e);
      }
    }

    if (!copied && typeof document !== "undefined") {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        copied = document.execCommand("copy");
      } catch (err) {
        console.error("execCommand fallback failed", err);
      }
      document.body.removeChild(textArea);
    }

    return { success: true, count: values.length, text: textToCopy };
  } catch (err) {
    console.error("Failed to copy column values to clipboard", err);
    return { success: false, count: 0, text: "" };
  }
}

/**
 * Copies specification/nominal values from a source table to a target table (e.g. Sibling sections in split_row).
 */
export function mirrorSiblingTableSpecs(
  sourceRows: CanvasRowData[],
  targetRows: CanvasRowData[],
  targetColumns: CanvasColumnDef[],
  defaultTolerance: number = 0.01,
  decimalPlaces: number = 3,
  unit: string = "mm"
): { updatedRows: CanvasRowData[]; count: number } {
  const result: CanvasRowData[] = targetRows.map((r) => ({ ...r }));
  const tol = defaultTolerance;
  const dec = decimalPlaces;
  let copiedCount = 0;

  for (let i = 0; i < sourceRows.length; i++) {
    const sRow = sourceRows[i];
    if (sRow.is_merged || sRow.isMerged) {
      continue;
    }

    let tRow: CanvasRowData;
    if (i < result.length) {
      tRow = { ...result[i] };
    } else {
      tRow = {
        point_number: sRow.point_number ?? i + 1,
        unit: sRow.unit || unit,
        tolerance: tol,
      };
      result.push(tRow);
    }

    if (sRow.nominal !== undefined) {
      tRow.nominal = sRow.nominal;
      tRow["nominal"] = sRow.nominal;
    }
    if (sRow.description !== undefined) {
      tRow.description = sRow.description;
      tRow["description"] = sRow.description;
    }
    if (sRow.specification !== undefined) {
      tRow.specification = sRow.specification;
      tRow["specification"] = sRow.specification;
    }
    if (sRow.tolerance !== undefined) {
      tRow.tolerance = sRow.tolerance;
      tRow["tolerance"] = sRow.tolerance;
    }
    if (sRow.lower_limit !== undefined) tRow.lower_limit = sRow.lower_limit;
    if (sRow.upper_limit !== undefined) tRow.upper_limit = sRow.upper_limit;
    if (sRow.lower_tolerance !== undefined) tRow.lower_tolerance = sRow.lower_tolerance;
    if (sRow.upper_tolerance !== undefined) tRow.upper_tolerance = sRow.upper_tolerance;

    // Re-evaluate target table formulas
    const evaluated = evaluateCanvasRowFormulas(tRow, targetColumns, tol, dec);
    result[i] = evaluated;
    copiedCount++;
  }

  return { updatedRows: result, count: copiedCount };
}

/**
 * Merges two standalone TableGridBlocks into a single SplitRowBlock (50/50 side-by-side).
 */
export function mergeTablesSideBySide(
  blocks: CanvasBlock[],
  tableAId: string,
  tableBId: string
): CanvasBlock[] {
  const tableAIndex = blocks.findIndex((b) => b.id === tableAId && b.type === "table_grid");
  const tableBIndex = blocks.findIndex((b) => b.id === tableBId && b.type === "table_grid");

  if (tableAIndex === -1 || tableBIndex === -1) {
    return blocks;
  }

  const tableA = blocks[tableAIndex] as TableGridBlock;
  const tableB = blocks[tableBIndex] as TableGridBlock;

  const newSplitRow: SplitRowBlock = {
    id: `split_${Date.now()}`,
    type: "split_row",
    columnsCount: 2,
    columnRatio: "50/50",
    children: [
      { ...tableA, width: "50%" },
      { ...tableB, width: "50%" },
    ],
  };

  // Place the new split_row at the position of Table A, and remove Table B
  const updatedBlocks: CanvasBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i === tableAIndex) {
      updatedBlocks.push(newSplitRow);
    } else if (i === tableBIndex) {
      // Omit Table B
      continue;
    } else {
      updatedBlocks.push(blocks[i]);
    }
  }

  return updatedBlocks;
}

/**
 * Reversibly unmerges a SplitRowBlock back into sequential standalone TableGridBlocks.
 */
export function unmergeSplitRow(
  blocks: CanvasBlock[],
  splitRowId: string
): CanvasBlock[] {
  const splitIndex = blocks.findIndex((b) => b.id === splitRowId && b.type === "split_row");
  if (splitIndex === -1) return blocks;

  const splitBlock = blocks[splitIndex] as SplitRowBlock;
  const childBlocks: CanvasBlock[] = (splitBlock.children || []).map((child, idx) => {
    if (child.type === "table_grid") {
      const tableChild = child as TableGridBlock;
      return {
        ...tableChild,
        id: tableChild.id || `table_${Date.now()}_${idx}`,
        type: "table_grid",
        width: "100%",
        columns: tableChild.columns || [],
        rows: tableChild.rows || [],
      } as TableGridBlock;
    }
    return {
      ...child,
      id: child.id || `block_${Date.now()}_${idx}`,
      width: "100%",
    } as CanvasBlock;
  });

  const updatedBlocks: CanvasBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i === splitIndex) {
      updatedBlocks.push(...childBlocks);
    } else {
      updatedBlocks.push(blocks[i]);
    }
  }

  return updatedBlocks;
}
