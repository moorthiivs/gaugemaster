import { MatrixCell, MatrixTableBlock } from "../types/template";

/**
 * Normalizes any cell (primitive string/number or MatrixCell object) into a strict MatrixCell.
 */
export function normalizeMatrixCell(cell: any): MatrixCell {
  if (typeof cell === "object" && cell !== null) {
    const colSpan = typeof cell.colSpan === "number" && !isNaN(cell.colSpan) && cell.colSpan > 0 ? cell.colSpan : 1;
    const rowSpan = typeof cell.rowSpan === "number" && !isNaN(cell.rowSpan) && cell.rowSpan > 0 ? cell.rowSpan : 1;
    return {
      text: cell.text !== undefined && cell.text !== null ? String(cell.text) : "",
      colSpan,
      rowSpan,
      align: cell.align || "center",
      isHeader: !!cell.isHeader,
    };
  }
  return {
    text: cell !== undefined && cell !== null ? String(cell) : "",
    colSpan: 1,
    rowSpan: 1,
    align: "center",
  };
}

/**
 * Computes 2D column count and a set of covered cell keys (`${rIdx}_${cIdx}`).
 * In HTML tables, cells in `coveredCells` MUST NOT render `<th/td>` to prevent layout deformation.
 */
export function computeMatrix2DGrid(
  rows2D: any[][],
  explicitCols?: number
): {
  totalCols: number;
  coveredCells: Set<string>;
  grid: (MatrixCell | null)[][];
} {
  const coveredCells = new Set<string>();
  if (!Array.isArray(rows2D) || rows2D.length === 0) {
    return { totalCols: explicitCols || 1, coveredCells, grid: [] };
  }

  // 1. Calculate column count
  let maxCols = explicitCols || 1;
  rows2D.forEach((row) => {
    if (!Array.isArray(row)) return;
    let rowSpanSum = 0;
    row.forEach((c) => {
      const norm = normalizeMatrixCell(c);
      rowSpanSum += (norm.colSpan || 1);
    });
    if (rowSpanSum > maxCols) maxCols = rowSpanSum;
  });

  const numRows = rows2D.length;
  const grid: (MatrixCell | null)[][] = Array.from({ length: numRows }, () =>
    Array(maxCols).fill(null)
  );

  // 2. Map cells into 2D grid and identify covered slots
  rows2D.forEach((row, rIdx) => {
    if (!Array.isArray(row)) return;
    let colPointer = 0;

    row.forEach((rawCell) => {
      // Advance to next non-covered slot
      while (colPointer < maxCols && grid[rIdx][colPointer] !== null) {
        colPointer++;
      }
      if (colPointer >= maxCols) return;

      const norm = normalizeMatrixCell(rawCell);
      const cSpan = Math.min(norm.colSpan || 1, maxCols - colPointer);
      const rSpan = Math.min(norm.rowSpan || 1, numRows - rIdx);

      const cellWithClampedSpans: MatrixCell = {
        ...norm,
        colSpan: cSpan,
        rowSpan: rSpan,
      };

      grid[rIdx][colPointer] = cellWithClampedSpans;

      // Mark covered slots
      for (let dr = 0; dr < rSpan; dr++) {
        for (let dc = 0; dc < cSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          const tr = rIdx + dr;
          const tc = colPointer + dc;
          if (tr < numRows && tc < maxCols) {
            grid[tr][tc] = { text: "", colSpan: 1, rowSpan: 1 };
            coveredCells.add(`${tr}_${tc}`);
          }
        }
      }

      colPointer += cSpan;
    });
  });

  return { totalCols: maxCols, coveredCells, grid };
}

/**
 * Updates a single cell's properties in a MatrixTableBlock.
 */
export function updateMatrixCell(
  block: MatrixTableBlock,
  isHeader: boolean,
  rIdx: number,
  cIdx: number,
  updates: Partial<MatrixCell>
): MatrixTableBlock {
  if (isHeader) {
    const newHeaders = (block.headers || []).map((row, r) => {
      if (r !== rIdx) return [...row];
      return row.map((cell, c) => {
        if (c !== cIdx) return cell;
        const norm = normalizeMatrixCell(cell);
        return { ...norm, ...updates };
      });
    });
    return { ...block, headers: newHeaders };
  } else {
    const newRows = (block.rows || []).map((row, r) => {
      if (r !== rIdx) return [...row];
      return row.map((cell, c) => {
        if (c !== cIdx) return cell;
        const norm = normalizeMatrixCell(cell);
        return { ...norm, ...updates };
      });
    });
    return { ...block, rows: newRows };
  }
}

/**
 * Calculates the true maximum number of columns in the 2D grid across headers and rows.
 */
export function getMatrixTotalCols(block: MatrixTableBlock): number {
  let maxCols = 1;
  const checkRows = (rows: any[][]) => {
    (rows || []).forEach((row) => {
      if (!Array.isArray(row)) return;
      let sum = 0;
      row.forEach((cell) => {
        const norm = normalizeMatrixCell(cell);
        sum += (norm.colSpan || 1);
      });
      if (sum > maxCols) maxCols = sum;
    });
  };
  checkRows(block.headers || []);
  checkRows(block.rows || []);
  return maxCols;
}

/**
 * Appends a new column to all header tiers and existing data rows.
 * If data rows are empty, leaves them empty (does not create dummy rows).
 */
export function addMatrixColumn(block: MatrixTableBlock): MatrixTableBlock {
  const currentTotalCols = getMatrixTotalCols(block);
  const newColNum = currentTotalCols + 1;

  const newHeaders = (block.headers && block.headers.length > 0 ? block.headers : [[]]).map((hRow) => [
    ...hRow,
    { text: `Col ${newColNum}`, colSpan: 1, rowSpan: 1, align: "center" as const, isHeader: true },
  ]);

  const newRows = (!block.rows || block.rows.length === 0)
    ? []
    : block.rows.map((rRow) => [
        ...rRow,
        { text: "-", colSpan: 1, rowSpan: 1, align: "center" as const },
      ]);

  return { ...block, headers: newHeaders, rows: newRows };
}

/**
 * Removes the column at 2D grid index `target2DCol` (or the last column) across headers and rows.
 * Preserves at least 1 column for structural integrity.
 * Correctly accounts for colSpan and rowSpan in 2D space.
 */
export function removeMatrixColumn(block: MatrixTableBlock, target2DCol?: number): MatrixTableBlock {
  const totalCols = getMatrixTotalCols(block);
  if (totalCols <= 1) return block;

  const delCol =
    target2DCol !== undefined && target2DCol >= 0 && target2DCol < totalCols
      ? target2DCol
      : totalCols - 1;

  const processRowGroup = (rows: any[][], isHeader: boolean): MatrixCell[][] => {
    const coveredSlots = new Set<string>();
    const newRows: MatrixCell[][] = [];

    (rows || []).forEach((row, rIdx) => {
      let colPointer = 0;
      const newRow: MatrixCell[] = [];

      (row || []).forEach((rawCell) => {
        while (colPointer < totalCols && coveredSlots.has(`${rIdx}_${colPointer}`)) {
          colPointer++;
        }
        const startCol = colPointer;
        const cell = normalizeMatrixCell(rawCell);
        const cSpan = cell.colSpan || 1;
        const rSpan = cell.rowSpan || 1;
        const endCol = startCol + cSpan - 1;

        // Mark covered slots
        for (let dr = 0; dr < rSpan; dr++) {
          for (let dc = 0; dc < cSpan; dc++) {
            if (dr !== 0 || dc !== 0) {
              coveredSlots.add(`${rIdx + dr}_${startCol + dc}`);
            }
          }
        }
        colPointer += cSpan;

        // If delCol falls inside this cell:
        if (delCol >= startCol && delCol <= endCol) {
          if (cSpan > 1) {
            newRow.push({ ...cell, colSpan: cSpan - 1, isHeader });
          }
          // If cSpan === 1, omitted!
        } else {
          newRow.push({ ...cell, isHeader });
        }
      });

      newRows.push(newRow);
    });

    return newRows;
  };

  const newHeaders = processRowGroup(block.headers || [], true);
  const newRows = processRowGroup(block.rows || [], false);

  return { ...block, headers: newHeaders, rows: newRows };
}

/**
 * Appends a new body row to the matrix table with columns matching the true 2D width.
 */
export function addMatrixRow(block: MatrixTableBlock): MatrixTableBlock {
  const totalCols = getMatrixTotalCols(block);
  const rowNum = (block.rows?.length || 0) + 1;

  const newRow: MatrixCell[] = Array.from({ length: totalCols }, (_, i) => ({
    text: i === 0 ? `Point ${rowNum}` : "-",
    colSpan: 1,
    rowSpan: 1,
    align: "center",
  }));

  return { ...block, rows: [...(block.rows || []), newRow] };
}

/**
 * Removes the data row at targetRowIdx (or the last row).
 * Safely decrements rowSpan for any earlier cells spanning into the deleted row.
 * Allows removing down to 0 rows.
 */
export function removeMatrixRow(block: MatrixTableBlock, targetRowIdx?: number): MatrixTableBlock {
  if (!block.rows || block.rows.length === 0) return block;
  const delIdx =
    targetRowIdx !== undefined && targetRowIdx >= 0 && targetRowIdx < block.rows.length
      ? targetRowIdx
      : block.rows.length - 1;

  // Adjust any earlier row cells that had rowSpan extending into delIdx
  const adjustedRows = block.rows.map((row, rIdx) => {
    if (rIdx >= delIdx) return row;
    return row.map((cell) => {
      const norm = normalizeMatrixCell(cell);
      const rSpan = norm.rowSpan || 1;
      if (rIdx + rSpan - 1 >= delIdx) {
        return { ...norm, rowSpan: Math.max(1, rSpan - 1) };
      }
      return cell;
    });
  });

  const newRows = adjustedRows.filter((_, i) => i !== delIdx);
  return { ...block, rows: newRows };
}

/**
 * Empties all body rows in the matrix table.
 */
export function clearMatrixRows(block: MatrixTableBlock): MatrixTableBlock {
  return { ...block, rows: [] };
}

/**
 * Resets a cell's text and merge spans back to blank default.
 */
export function clearMatrixCell(
  block: MatrixTableBlock,
  isHeader: boolean,
  rowIndex: number,
  colIndex: number
): MatrixTableBlock {
  return updateMatrixCell(block, isHeader, rowIndex, colIndex, {
    text: "",
    colSpan: 1,
    rowSpan: 1,
  });
}

/**
 * Adds a new header row tier matching the true 2D width.
 */
export function addMatrixHeaderRow(block: MatrixTableBlock): MatrixTableBlock {
  const totalCols = getMatrixTotalCols(block);
  const tierNum = (block.headers?.length || 0) + 1;

  const newHeaderRow: MatrixCell[] = Array.from({ length: totalCols }, (_, i) => ({
    text: `Header Tier ${tierNum}.${i + 1}`,
    colSpan: 1,
    rowSpan: 1,
    align: "center",
    isHeader: true,
  }));

  return { ...block, headers: [...(block.headers || []), newHeaderRow] };
}

/**
 * Removes the header tier at targetHIdx (or the last tier).
 * Safely decrements rowSpan for any earlier header cells spanning into the deleted tier.
 */
export function removeMatrixHeaderRow(block: MatrixTableBlock, targetHIdx?: number): MatrixTableBlock {
  if (!block.headers || block.headers.length <= 1) return block;
  const delIdx =
    targetHIdx !== undefined && targetHIdx >= 0 && targetHIdx < block.headers.length
      ? targetHIdx
      : block.headers.length - 1;

  // Adjust any earlier header tier cells that had rowSpan extending into delIdx
  const adjustedHeaders = block.headers.map((hRow, hIdx) => {
    if (hIdx >= delIdx) return hRow;
    return hRow.map((cell) => {
      const norm = normalizeMatrixCell(cell);
      const rSpan = norm.rowSpan || 1;
      if (hIdx + rSpan - 1 >= delIdx) {
        return { ...norm, rowSpan: Math.max(1, rSpan - 1) };
      }
      return cell;
    });
  });

  const newHeaders = adjustedHeaders.filter((_, i) => i !== delIdx);
  return { ...block, headers: newHeaders };
}

/**
 * Preset for IS 2092:1983 Dial Gauge Limits of Error (exactly matching Image 2).
 */
export function createIS2092DialGaugePreset(): Partial<MatrixTableBlock> {
  return {
    title: "Limits of Error (IS 2092:1983 Reference)",
    width: "100%",
    headers: [
      [
        { text: "Requirement", colSpan: 1, rowSpan: 2, align: "center", isHeader: true },
        { text: "Limits of Error (mm)", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
      ],
      [
        { text: "0.01 Dial Gauge", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "0.002 Dial Gauge", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
      ],
    ],
    rows: [
      [
        { text: "Sensitivity (including hysteresis) / Change of 0.025 to 0.005", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.003", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.001", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "Repeatability", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.002", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.0005", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "Accuracy over an interval of: Any 1/10th rev.", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.009", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.001", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "Accuracy over an interval of: Any 1 rev.", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.010", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.004", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "Accuracy over an interval of: Any 2 revs.", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.015", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.006", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "Accuracy over an interval of: Any larger interval up to 10 revs.", colSpan: 1, rowSpan: 1, align: "left" },
        { text: "0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "0.018", colSpan: 1, rowSpan: 1, align: "center" },
      ],
    ],
    footerNote: "As Per IS 2092:1983 / AE/CAL-SOP/01",
  };
}

export interface HeaderGroupItem {
  type: "group" | "single";
  groupName?: string;
  colSpan: number;
  columns: any[];
}

/**
 * Computes 2-tier header structure for data tables when columns have `groupName`.
 */
export function computeHeaderGroups(columns: any[]): {
  hasGroups: boolean;
  topRow: HeaderGroupItem[];
  subRowColumns: any[];
} {
  const hasGroups = (columns || []).some((c) => c && c.groupName && String(c.groupName).trim() !== "");
  if (!hasGroups) {
    return { hasGroups: false, topRow: [], subRowColumns: [] };
  }

  const topRow: HeaderGroupItem[] = [];
  let currentGroup: string | undefined = undefined;
  let currentGroupCols: any[] = [];

  for (const col of columns) {
    const g = col && col.groupName ? String(col.groupName).trim() : undefined;
    if (g) {
      if (currentGroup === g) {
        currentGroupCols.push(col);
      } else {
        if (currentGroup) {
          topRow.push({
            type: "group",
            groupName: currentGroup,
            colSpan: currentGroupCols.length,
            columns: currentGroupCols,
          });
        }
        currentGroup = g;
        currentGroupCols = [col];
      }
    } else {
      if (currentGroup) {
        topRow.push({
          type: "group",
          groupName: currentGroup,
          colSpan: currentGroupCols.length,
          columns: currentGroupCols,
        });
        currentGroup = undefined;
        currentGroupCols = [];
      }
      topRow.push({
        type: "single",
        colSpan: 1,
        columns: [col],
      });
    }
  }

  if (currentGroup) {
    topRow.push({
      type: "group",
      groupName: currentGroup,
      colSpan: currentGroupCols.length,
      columns: currentGroupCols,
    });
  }

  const subRowColumns = (columns || []).filter((c) => c && c.groupName && String(c.groupName).trim() !== "");

  return { hasGroups: true, topRow, subRowColumns };
}

