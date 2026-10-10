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
 * Simulates 2D row placement accounting for colSpan and rowSpan to determine the true maximum column width.
 */
function getRows2DMaxCols(rows: any[][]): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const covered = new Map<number, Set<number>>();
  let overallMaxCol = 0;

  rows.forEach((row, rIdx) => {
    if (!Array.isArray(row)) return;
    let colPointer = 0;
    const coveredInThisRow = covered.get(rIdx);

    row.forEach((rawCell) => {
      while (coveredInThisRow && coveredInThisRow.has(colPointer)) {
        colPointer++;
      }
      const norm = normalizeMatrixCell(rawCell);
      const cSpan = norm.colSpan || 1;
      const rSpan = norm.rowSpan || 1;

      if (rSpan > 1) {
        for (let dr = 1; dr < rSpan; dr++) {
          const targetR = rIdx + dr;
          if (!covered.has(targetR)) covered.set(targetR, new Set());
          const covSet = covered.get(targetR)!;
          for (let dc = 0; dc < cSpan; dc++) {
            covSet.add(colPointer + dc);
          }
        }
      }

      colPointer += cSpan;
      if (colPointer > overallMaxCol) {
        overallMaxCol = colPointer;
      }
    });
  });

  return overallMaxCol;
}

/**
 * Calculates the true maximum number of columns in the 2D grid across headers and rows.
 */
export function getMatrixTotalCols(block: MatrixTableBlock): number {
  const hCols = getRows2DMaxCols(block.headers || []);
  const rCols = getRows2DMaxCols(block.rows || []);
  return Math.max(1, hCols, rCols);
}

/**
 * Merges a cell horizontally across `targetColSpan` columns.
 * CRITICAL GEOMETRY INVARIANT:
 * - When expanding colSpan: absorbs (removes or shrinks) adjacent cells to the right so row width NEVER increases.
 * - When reducing/resetting colSpan: inserts freed 1-span cells so row width NEVER collapses.
 */
export function mergeMatrixCellAcrossCols(
  block: MatrixTableBlock,
  isHeader: boolean,
  rIdx: number,
  cellArrayIdx: number,
  targetColSpan: number
): MatrixTableBlock {
  const targetSpan = Math.max(1, targetColSpan);

  const processRowGroup = <T extends any[]>(rows: T[]): T[] => {
    return rows.map((row, r) => {
      if (r !== rIdx) return [...row] as unknown as T;
      const rowCopy: MatrixCell[] = row.map((c) => ({ ...normalizeMatrixCell(c), isHeader }));
      const currentCell = rowCopy[cellArrayIdx];
      if (!currentCell) return rowCopy as unknown as T;
      const currentSpan = currentCell.colSpan || 1;

      if (targetSpan === currentSpan) return rowCopy as unknown as T;

      if (targetSpan > currentSpan) {
        let neededCols = targetSpan - currentSpan;
        let nextIdx = cellArrayIdx + 1;

        while (neededCols > 0 && nextIdx < rowCopy.length) {
          const nextCell = rowCopy[nextIdx];
          const nextSpan = nextCell.colSpan || 1;

          if (nextSpan <= neededCols) {
            neededCols -= nextSpan;
            rowCopy.splice(nextIdx, 1);
          } else {
            rowCopy[nextIdx] = {
              ...nextCell,
              colSpan: nextSpan - neededCols,
            };
            neededCols = 0;
            break;
          }
        }

        const actualNewSpan = targetSpan - neededCols;
        rowCopy[cellArrayIdx] = {
          ...currentCell,
          colSpan: actualNewSpan,
        };
      } else {
        const freedCols = currentSpan - targetSpan;
        rowCopy[cellArrayIdx] = {
          ...currentCell,
          colSpan: targetSpan,
        };

        for (let k = 0; k < freedCols; k++) {
          const fillerCell: MatrixCell = {
            text: isHeader ? "" : "-",
            colSpan: 1,
            rowSpan: 1,
            align: "center",
            isHeader,
          };
          rowCopy.splice(cellArrayIdx + 1 + k, 0, fillerCell);
        }
      }

      return rowCopy as unknown as T;
    });
  };

  if (isHeader) {
    if (!block.headers || !block.headers[rIdx] || !block.headers[rIdx][cellArrayIdx]) return block;
    const cleanHeaders = processRowGroup(block.headers);
    return normalizeMatrixTableGeometry({ ...block, headers: cleanHeaders });
  } else {
    if (!block.rows || !block.rows[rIdx] || !block.rows[rIdx][cellArrayIdx]) return block;
    const cleanRows = processRowGroup(block.rows);
    return normalizeMatrixTableGeometry({ ...block, rows: cleanRows });
  }
}

/**
 * Merges a cell vertically down across `targetRowSpan` rows.
 * In HTML tables, cells in lower rows within the covered column range must be absorbed
 * so they do not shift lower tiers out and spawn phantom columns.
 */
export function mergeMatrixCellDownRows(
  block: MatrixTableBlock,
  isHeader: boolean,
  rIdx: number,
  cellArrayIdx: number,
  targetRowSpan: number
): MatrixTableBlock {
  const targetSpan = Math.max(1, targetRowSpan);

  if (isHeader) {
    if (!block.headers || !block.headers[rIdx] || !block.headers[rIdx][cellArrayIdx]) return block;
    const clampedSpan = Math.min(targetSpan, block.headers.length - rIdx);
    const updatedHeaders: MatrixCell[][] = block.headers.map((row) =>
      row.map((c) => ({ ...normalizeMatrixCell(c), isHeader: true }))
    );
    const currentCell = normalizeMatrixCell(updatedHeaders[rIdx][cellArrayIdx]);
    updatedHeaders[rIdx][cellArrayIdx] = {
      ...currentCell,
      rowSpan: clampedSpan,
      isHeader: true,
    };
    return normalizeMatrixTableGeometry({ ...block, headers: updatedHeaders });
  } else {
    if (!block.rows || !block.rows[rIdx] || !block.rows[rIdx][cellArrayIdx]) return block;
    const clampedSpan = Math.min(targetSpan, block.rows.length - rIdx);
    const updatedRows = block.rows.map((row) =>
      row.map((c) => ({ ...normalizeMatrixCell(c), isHeader: false }))
    );
    const currentCell = normalizeMatrixCell(updatedRows[rIdx][cellArrayIdx]);
    updatedRows[rIdx][cellArrayIdx] = {
      ...currentCell,
      rowSpan: clampedSpan,
      isHeader: false,
    };
    return normalizeMatrixTableGeometry({ ...block, rows: updatedRows });
  }
}

/**
 * Normalizes and heals a MatrixTableBlock so that all header tiers and body rows
 * have EXACT matching total column counts in 2D space.
 * Eliminates empty phantom columns, orphan cells, and misalignment.
 */
export function normalizeMatrixTableGeometry(block: MatrixTableBlock): MatrixTableBlock {
  const currentTotalCols = getMatrixTotalCols(block);
  if (currentTotalCols <= 0) return block;

  const normalizeRowGroup = (rows: any[][], isHeader: boolean): MatrixCell[][] => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const numRows = rows.length;
    const grid: (MatrixCell | null)[][] = Array.from({ length: numRows }, () =>
      Array(currentTotalCols).fill(null)
    );

    const resultRows: MatrixCell[][] = [];

    rows.forEach((row, rIdx) => {
      let colPointer = 0;
      const cleanRow: MatrixCell[] = [];

      (row || []).forEach((rawCell) => {
        // Advance past covered slots from upper rows' rowSpan
        while (colPointer < currentTotalCols && grid[rIdx][colPointer] !== null) {
          colPointer++;
        }
        if (colPointer >= currentTotalCols) return; // Discard cells extending past currentTotalCols

        const norm = normalizeMatrixCell(rawCell);
        const cSpan = Math.min(norm.colSpan || 1, currentTotalCols - colPointer);
        const rSpan = Math.min(norm.rowSpan || 1, numRows - rIdx);

        const clampedCell: MatrixCell = {
          ...norm,
          colSpan: cSpan,
          rowSpan: rSpan,
          isHeader,
        };

        cleanRow.push(clampedCell);

        // Mark 2D grid slots
        for (let dr = 0; dr < rSpan; dr++) {
          for (let dc = 0; dc < cSpan; dc++) {
            const tr = rIdx + dr;
            const tc = colPointer + dc;
            if (tr < numRows && tc < currentTotalCols) {
              grid[tr][tc] = clampedCell;
            }
          }
        }

        colPointer += cSpan;
      });

      // If this row is short of currentTotalCols, fill remaining slots with default cells
      while (colPointer < currentTotalCols) {
        if (grid[rIdx][colPointer] !== null) {
          colPointer++;
        } else {
          const fillCell: MatrixCell = {
            text: isHeader ? `Col ${colPointer + 1}` : "-",
            colSpan: 1,
            rowSpan: 1,
            align: "center",
            isHeader,
          };
          cleanRow.push(fillCell);
          grid[rIdx][colPointer] = fillCell;
          colPointer++;
        }
      }

      resultRows.push(cleanRow);
    });

    return resultRows;
  };

  const cleanHeaders = normalizeRowGroup(block.headers || [], true);
  const cleanRows = normalizeRowGroup(block.rows || [], false);

  return {
    ...block,
    headers: cleanHeaders,
    rows: cleanRows,
  };
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

  return normalizeMatrixTableGeometry({ ...block, headers: newHeaders, rows: newRows });
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

  return normalizeMatrixTableGeometry({ ...block, headers: newHeaders, rows: newRows });
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

/**
 * Standard 7-Column Acceptance Criteria Reference Matrix Preset for Vernier Calipers (IS 3651 / AE/CAL-SOP/01).
 * Features:
 * - Tier 1: LEAST COUNT (rowSpan 2) + 0.01mm (colSpan 2) + 0.02mm (colSpan 2) + 0.05mm (colSpan 2)
 * - Tier 2: Maximum Permissible Error (MPE) (colSpan 6 across all least count columns)
 * - Tier 3: Length (mm), New, Recalib, New, Recalib, New, Recalib (7 cols)
 * - Rows: Standard calibration length ranges (0-100, 100-300, 300-600)
 */
export function createVernierCaliper7ColPreset(): Partial<MatrixTableBlock> {
  return {
    title: "Acceptance Criteria Reference Matrix (Vernier Caliper)",
    width: "100%",
    headers: [
      [
        { text: "LEAST COUNT", rowSpan: 2, colSpan: 1, align: "center", isHeader: true },
        { text: "0.01mm", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
        { text: "0.02mm", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
        { text: "0.05mm", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
      ],
      [
        { text: "Maximum Permissible Error (MPE)", colSpan: 6, rowSpan: 1, align: "center", isHeader: true },
      ],
      [
        { text: "Length (mm)", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "New", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "Recalib", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "New", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "Recalib", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "New", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "Recalib", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
      ],
    ],
    rows: [
      [
        { text: "0 - 100", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.010", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.050", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.050", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "100 - 300", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.040", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.050", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.060", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "300 - 600", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.040", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.040", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.050", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.060", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.080", colSpan: 1, rowSpan: 1, align: "center" },
      ],
    ],
    footerNote: "As Per IS 3651 (Part 1 & 2) / AE/CAL-SOP/01",
  };
}

/**
 * Standard 5-Column Acceptance Criteria Reference Matrix Preset (0.01mm & 0.02mm).
 */
export function createCaliper5ColPreset(): Partial<MatrixTableBlock> {
  return {
    title: "Acceptance Criteria Reference Matrix",
    width: "100%",
    headers: [
      [
        { text: "LEAST COUNT", rowSpan: 2, colSpan: 1, align: "center", isHeader: true },
        { text: "0.01mm", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
        { text: "0.02mm", colSpan: 2, rowSpan: 1, align: "center", isHeader: true },
      ],
      [
        { text: "Maximum Permissible Error (MPE)", colSpan: 4, rowSpan: 1, align: "center", isHeader: true },
      ],
      [
        { text: "Length (mm)", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "New", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "Recalib", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "New", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
        { text: "Recalib", colSpan: 1, rowSpan: 1, align: "center", isHeader: true },
      ],
    ],
    rows: [
      [
        { text: "0 - 100", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.010", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
      ],
      [
        { text: "100 - 300", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.020", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.030", colSpan: 1, rowSpan: 1, align: "center" },
        { text: "±0.040", colSpan: 1, rowSpan: 1, align: "center" },
      ],
    ],
    footerNote: "As Per ISO 17025 / AE/CAL-SOP/01",
  };
}

/**
 * Clean Blank Matrix Table Preset (customizable column and row count).
 */
export function createBlankMatrixPreset(cols = 4, rows = 3): Partial<MatrixTableBlock> {
  return {
    title: "Reference Matrix Table",
    width: "100%",
    headers: [
      Array.from({ length: cols }, (_, i) => ({
        text: `Header ${i + 1}`,
        colSpan: 1,
        rowSpan: 1,
        align: "center" as const,
        isHeader: true,
      })),
    ],
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        text: c === 0 ? `Point ${r + 1}` : "-",
        colSpan: 1,
        rowSpan: 1,
        align: "center" as const,
      }))
    ),
    footerNote: "",
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

