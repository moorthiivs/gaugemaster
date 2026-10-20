/**
 * Utility to calculate vertical text centering in PDFMake table cells.
 * 
 * In PDFMake, tables layout cells from top-to-bottom without native vertical centering.
 * When any cell in a row contains multi-line text (explicit newlines or word wrapping),
 * the entire row height expands to fit the tallest cell, leaving single-line sibling cells
 * pinned to the top border.
 * 
 * This utility estimates the height of every cell in each row and calculates a proportional
 * top margin for shorter cells, aligning their vertical midpoints cleanly with the tallest cell.
 */

export interface CellHeightInfo {
  lines: number;
  height: number;
}

/**
 * Extracts all plain text from a pdfmake cell node.
 */
export function getCellText(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  if (typeof cell.text === 'string' || typeof cell.text === 'number') return String(cell.text);
  if (Array.isArray(cell.text)) {
    return cell.text.map((t: any) => (typeof t === 'string' ? t : t?.text || '')).join('');
  }
  if (Array.isArray(cell.stack)) {
    return cell.stack.map((s: any) => getCellText(s)).join('\n');
  }
  return '';
}

/**
 * Estimates the vertical content height and number of text lines for a table cell.
 */
export function estimateCellHeight(
  cell: any,
  colWidth: number,
  defaultFontSize: number = 7.0,
  lineHeightFactor: number = 1.15,
): CellHeightInfo {
  if (!cell || typeof cell !== 'object') {
    const text = String(cell || '');
    return { lines: 1, height: defaultFontSize * lineHeightFactor };
  }
  if (cell.image || cell.svg) {
    const h = (cell.fit && cell.fit[1]) || cell.height || 20;
    return { lines: 1, height: h };
  }
  const fontSize = Number(cell.fontSize) || defaultFontSize;
  const singleLineH = fontSize * lineHeightFactor;

  if (Array.isArray(cell.stack)) {
    let totalH = 0;
    let totalL = 0;
    for (const item of cell.stack) {
      const res = estimateCellHeight(item, colWidth, fontSize, lineHeightFactor);
      totalH += res.height;
      totalL += res.lines;
    }
    return { lines: Math.max(1, totalL), height: Math.max(singleLineH, totalH) };
  }

  const text = getCellText(cell);
  if (!text || cell.noWrap) {
    return { lines: 1, height: singleLineH };
  }

  // Subtract typical horizontal cell padding (~3pt total)
  const availWidth = Math.max(10, colWidth - 3.5);
  // Average character width for Arial / Helvetica proportional fonts
  const avgCharWidth = fontSize * 0.53;
  const maxCharsPerLine = Math.max(1, Math.floor(availWidth / avgCharWidth));

  const rawLines = text.split('\n');
  let totalLines = 0;

  for (const expLine of rawLines) {
    if (expLine.trim().length === 0) {
      totalLines += 1;
      continue;
    }
    const words = expLine.split(/\s+/).filter(Boolean);
    let currentLineChars = 0;
    let linesForExp = 1;

    for (const word of words) {
      let wLen = word.length;
      while (wLen > maxCharsPerLine) {
        linesForExp++;
        wLen -= maxCharsPerLine;
      }
      if (currentLineChars === 0) {
        currentLineChars = wLen;
      } else if (currentLineChars + 1 + wLen <= maxCharsPerLine) {
        currentLineChars += 1 + wLen;
      } else {
        linesForExp++;
        currentLineChars = wLen;
      }
    }
    totalLines += linesForExp;
  }

  const lines = Math.max(1, totalLines);
  return { lines, height: lines * singleLineH };
}

/**
 * Resolves width expressions (numbers, percentages, '*', 'auto') into numerical point widths.
 */
export function resolveColWidths(widths: any[], totalWidth: number): number[] {
  if (!Array.isArray(widths) || widths.length === 0) return [totalWidth];
  const count = widths.length;
  let fixedSum = 0;
  let flexCount = 0;
  const resolved: (number | '*')[] = [];

  for (let i = 0; i < count; i++) {
    const w = widths[i];
    if (typeof w === 'number' && !isNaN(w) && w > 0) {
      resolved.push(w);
      fixedSum += w;
    } else if (typeof w === 'string' && w.endsWith('%')) {
      const pct = parseFloat(w);
      const val = (pct / 100) * totalWidth;
      resolved.push(val);
      fixedSum += val;
    } else if (typeof w === 'string' && !isNaN(parseFloat(w))) {
      const val = parseFloat(w);
      resolved.push(val);
      fixedSum += val;
    } else {
      resolved.push('*');
      flexCount++;
    }
  }

  if (flexCount > 0) {
    const remaining = Math.max(10 * flexCount, totalWidth - fixedSum);
    const flexWidth = remaining / flexCount;
    for (let i = 0; i < count; i++) {
      if (resolved[i] === '*') {
        resolved[i] = flexWidth;
      }
    }
  }
  return resolved as number[];
}

/**
 * Adjusts cell margins in a table node so that single-line or shorter cells
 * are vertically centered with multi-line cells in the same row.
 */
export function applyVerticalAlignmentToTable(
  tableNode: any,
  totalWidth: number,
  defaultFontSize: number = 7.0,
): any {
  if (!tableNode || !tableNode.table || !Array.isArray(tableNode.table.body)) return tableNode;
  if (tableNode._vAligned) return tableNode;
  tableNode._vAligned = true;

  const body = tableNode.table.body;
  const colWidths = resolveColWidths(tableNode.table.widths, totalWidth);

  for (let rIdx = 0; rIdx < body.length; rIdx++) {
    const row = body[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Skip full-width merged rows (e.g. statement or section titles)
    if (row.length === 1 || (row[0] && row[0].colSpan === colWidths.length)) {
      continue;
    }

    const cellHeights: (CellHeightInfo | null)[] = [];
    let maxHeight = 0;

    // Phase 1: Measure height of all regular cells in this row
    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const cell = row[cIdx];
      // Skip empty placeholder cells for colSpan/rowSpan
      if (!cell || (typeof cell === 'object' && Object.keys(cell).length === 0)) {
        cellHeights.push(null);
        continue;
      }
      // If cell has rowSpan > 1, its height spans across rows; don't use it to vertically align single row
      if (cell.rowSpan && cell.rowSpan > 1) {
        cellHeights.push(null);
        continue;
      }

      const colSpan = cell.colSpan || 1;
      let effectiveWidth = colWidths[cIdx] || 50;
      if (colSpan > 1) {
        for (let k = 1; k < colSpan && cIdx + k < colWidths.length; k++) {
          effectiveWidth += colWidths[cIdx + k] || 50;
        }
      }

      const hInfo = estimateCellHeight(cell, effectiveWidth, defaultFontSize);
      cellHeights.push(hInfo);
      if (hInfo.height > maxHeight) {
        maxHeight = hInfo.height;
      }
    }

    // Phase 2: Add top padding to vertically center cells shorter than the tallest cell
    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const cell = row[cIdx];
      const hInfo = cellHeights[cIdx];
      if (!cell || !hInfo || typeof cell !== 'object') continue;
      if (cell.rowSpan && cell.rowSpan > 1) continue;

      const diff = maxHeight - hInfo.height;
      if (diff >= 1.5) {
        const padTop = Math.round((diff / 2) * 10) / 10;
        const curMargin = Array.isArray(cell.margin) ? [...cell.margin] : [0, 0.5, 0, 0.5];
        while (curMargin.length < 4) curMargin.push(0);
        curMargin[1] = Math.round((curMargin[1] + padTop) * 10) / 10;
        cell.margin = curMargin;
      }
    }
  }
  return tableNode;
}

/**
 * Recursively traverses a docDefinition structure and applies vertical alignment
 * to all table nodes found in content, columns, or stacks.
 */
export function walkAndAlignPdfTables(
  node: any,
  totalWidth: number,
  defaultFontSize: number = 7.0,
): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      walkAndAlignPdfTables(item, totalWidth, defaultFontSize);
    }
    return;
  }
  if (typeof node === 'object') {
    if (node.table && Array.isArray(node.table.body)) {
      applyVerticalAlignmentToTable(node, totalWidth, defaultFontSize);
    }
    if (Array.isArray(node.columns)) {
      for (const col of node.columns) {
        walkAndAlignPdfTables(col, totalWidth, defaultFontSize);
      }
    }
    if (Array.isArray(node.stack)) {
      for (const item of node.stack) {
        walkAndAlignPdfTables(item, totalWidth, defaultFontSize);
      }
    }
  }
}
