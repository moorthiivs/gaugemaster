/**
 * table-span.util.ts
 * Utility functions for 2D cell merging (colSpan & rowSpan) in calibration certificate tables.
 * 
 * Strict Invariants:
 * 1. Statement rows (is_merged / isMerged === true) are FULL ROW banners and do not interact
 *    with cellSpans. They are completely bypassed by this utility.
 * 2. Origin cell: The top-left cell where the merge starts (rIdx, cIdx).
 * 3. Covered cells: All secondary cells inside the (rowSpan x colSpan) bounding rectangle
 *    excluding the origin cell. In PDFMake, covered cells must be represented by an empty object {}.
 */

export interface CellSpanData {
  colSpan?: number;
  rowSpan?: number;
  text?: string;
}

/**
 * Returns a Set of keys in the format `${rIdx}_${colId}` representing all cells
 * that are covered by an active colSpan or rowSpan from an earlier origin cell.
 */
export function getCoveredCells(
  rows: Array<{ [key: string]: any; cellSpans?: Record<string, CellSpanData>; is_merged?: boolean; isMerged?: boolean }>,
  columns: Array<{ id: string; [key: string]: any }>
): Set<string> {
  const covered = new Set<string>();
  if (!Array.isArray(rows) || !Array.isArray(columns) || rows.length === 0 || columns.length === 0) {
    return covered;
  }

  const colIdByIndex = columns.map((c) => c.id);

  rows.forEach((r, rIdx) => {
    // Statement rows span the entire row and are handled independently
    if (!r || r.is_merged || r.isMerged || !r.cellSpans) return;

    columns.forEach((col, cIdx) => {
      const spanInfo = r.cellSpans?.[col.id];
      if (!spanInfo) return;

      const cSpan = Math.max(1, typeof spanInfo.colSpan === 'number' && !isNaN(spanInfo.colSpan) ? spanInfo.colSpan : 1);
      const rSpan = Math.max(1, typeof spanInfo.rowSpan === 'number' && !isNaN(spanInfo.rowSpan) ? spanInfo.rowSpan : 1);

      if (cSpan <= 1 && rSpan <= 1) return;

      // Mark all (dr, dc) cells within this span as covered, except the origin (0, 0)
      for (let dr = 0; dr < rSpan; dr++) {
        for (let dc = 0; dc < cSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          const targetRow = rIdx + dr;
          // Never cover a statement row
          if (rows[targetRow] && (rows[targetRow].is_merged || rows[targetRow].isMerged)) continue;
          const targetColId = colIdByIndex[cIdx + dc];
          if (targetColId !== undefined && targetRow < rows.length) {
            covered.add(`${targetRow}_${targetColId}`);
          }
        }
      }
    });
  });

  return covered;
}

/**
 * Helper to get clean, validated colSpan and rowSpan for a cell.
 */
export function getCellSpanDimensions(
  cellSpans?: Record<string, CellSpanData>,
  colId?: string
): { colSpan: number; rowSpan: number; isMerged: boolean } {
  if (!cellSpans || !colId || !cellSpans[colId]) {
    return { colSpan: 1, rowSpan: 1, isMerged: false };
  }
  const span = cellSpans[colId];
  const colSpan = Math.max(1, typeof span.colSpan === 'number' && !isNaN(span.colSpan) ? span.colSpan : 1);
  const rowSpan = Math.max(1, typeof span.rowSpan === 'number' && !isNaN(span.rowSpan) ? span.rowSpan : 1);
  return {
    colSpan,
    rowSpan,
    isMerged: colSpan > 1 || rowSpan > 1,
  };
}
