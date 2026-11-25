import { getEffectiveTableOrientation } from "@/lib/tableLayoutOptimizer";

export interface CertificatePageSlice {
  pageIndex: number;
  sheetNumber: number;
  start: number;
  end: number;
  isFirst: boolean;
  isLast: boolean;
  blocks?: any[];
}

export interface SheetCapacityConfig {
  singleCapacity: number;
  p1Capacity: number;
  continuationCapacity: number;
  finalSheetCapacity: number;
}

/**
 * Row-unit budget per sheet matching CertificatePreview A4 frame heights.
 * Includes ~2 units of baseline table title/header overhead already expected by single-table templates.
 */
export function getSheetCapacities(hasDiagram: boolean = false): SheetCapacityConfig {
  return {
    singleCapacity: hasDiagram ? 16 : 28,
    p1Capacity: hasDiagram ? 26 : 39,
    continuationCapacity: 52,
    finalSheetCapacity: 38,
  };
}

function isSplittableTableBlock(block: any): boolean {
  if (!block || typeof block !== "object") return false;
  return (
    block.type === "table_grid" ||
    block.type === "table" ||
    block.type === "matrix_table" ||
    Array.isArray(block.rows)
  );
}

function isHorizontalTableBlock(block: any): boolean {
  return Boolean(block && block.type === "table_grid" && getEffectiveTableOrientation(block) === "horizontal");
}

function getTableHeaderUnits(block: any): number {
  if (!block) return 0;
  let units = 0;
  const hasTitle = Boolean(block.title && String(block.title).trim() !== "");
  if (hasTitle) units += 1;

  if (block.type === "matrix_table") {
    units += Math.max(1, Array.isArray(block.headers) ? block.headers.length : 1);
  } else if (isHorizontalTableBlock(block)) {
    units += 1;
  } else {
    const hasGroups =
      Array.isArray(block.columns) &&
      block.columns.some((c: any) => c && c.groupName && String(c.groupName).trim() !== "");
    units += hasGroups ? 2 : 1;
  }

  if (block.footerNote) units += 1;
  return units;
}

function getTableBodyUnits(block: any): number {
  if (!block) return 0;
  if (isHorizontalTableBlock(block)) {
    const displayCols = (block.columns || []).filter(
      (c: any) => c && c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino"
    );
    return Math.max(1, displayCols.length);
  }
  return Array.isArray(block.rows) ? block.rows.length : 0;
}

function estimateSingleBlockUnits(block: any): number {
  if (!block || typeof block !== "object") return 0;
  if (block.type === "page_break") return 0;
  if (block.type === "text_block") return 1;
  if (block.type === "diagram" || block.type === "diagram_block") return 7;
  if (block.type === "split_row" && Array.isArray(block.children)) {
    return block.children.reduce(
      (maxH: number, child: any) => Math.max(maxH, estimateSingleBlockUnits(child)),
      0
    );
  }
  if (isSplittableTableBlock(block)) {
    return getTableHeaderUnits(block) + getTableBodyUnits(block);
  }
  return 1;
}

/**
 * Counts total data points across all tables (including nested tables inside split_row blocks).
 */
export function countCanvasDataRows(blocks: any[] | undefined): number {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return 0;
  let total = 0;

  for (const block of blocks) {
    if (!block) continue;
    if (isSplittableTableBlock(block) && Array.isArray(block.rows)) {
      total += block.rows.length;
    } else if (block.type === "split_row" && Array.isArray(block.children)) {
      for (const child of block.children) {
        if (child && isSplittableTableBlock(child) && Array.isArray(child.rows)) {
          total += child.rows.length;
        }
      }
    }
  }
  return total;
}

/**
 * Legacy row-count-based page slice calculator (used when layoutBlocks are absent
 * and for backwards-compatible callers).
 */
export function calculatePageSlices(totalDataRows: number, hasDiagram: boolean = false): CertificatePageSlice[] {
  if (totalDataRows <= 0) {
    return [{ pageIndex: 0, sheetNumber: 1, start: 0, end: 0, isFirst: true, isLast: true }];
  }

  const singleCapacity = hasDiagram ? 14 : 26;
  if (totalDataRows <= singleCapacity) {
    return [
      {
        pageIndex: 0,
        sheetNumber: 1,
        start: 0,
        end: totalDataRows,
        isFirst: true,
        isLast: true,
      },
    ];
  }

  const p1Capacity = hasDiagram ? 24 : 37;
  const continuationCapacity = 50;
  const finalSheetCapacity = 36;

  if (totalDataRows <= p1Capacity + finalSheetCapacity) {
    const s1 =
      totalDataRows <= p1Capacity + 12
        ? Math.ceil(totalDataRows / 2)
        : Math.min(p1Capacity, totalDataRows - 15);
    return [
      { pageIndex: 0, sheetNumber: 1, start: 0, end: s1, isFirst: true, isLast: false },
      { pageIndex: 1, sheetNumber: 2, start: s1, end: totalDataRows, isFirst: false, isLast: true },
    ];
  }

  const slices: CertificatePageSlice[] = [];
  let currentStart = 0;
  let remaining = totalDataRows;

  const p1Count = Math.min(remaining, p1Capacity);
  slices.push({
    pageIndex: 0,
    sheetNumber: 1,
    start: currentStart,
    end: currentStart + p1Count,
    isFirst: true,
    isLast: false,
  });
  currentStart += p1Count;
  remaining -= p1Count;

  while (remaining > finalSheetCapacity) {
    if (remaining <= finalSheetCapacity + 14) {
      const half = Math.ceil(remaining / 2);
      slices.push({
        pageIndex: slices.length,
        sheetNumber: slices.length + 1,
        start: currentStart,
        end: currentStart + half,
        isFirst: false,
        isLast: false,
      });
      currentStart += half;
      remaining -= half;
      break;
    }

    const pCount = Math.min(remaining, continuationCapacity);
    const remainingAfter = remaining - pCount;
    if (remainingAfter > 0 && remainingAfter < 10) {
      const balanced = Math.ceil(remaining / 2);
      slices.push({
        pageIndex: slices.length,
        sheetNumber: slices.length + 1,
        start: currentStart,
        end: currentStart + balanced,
        isFirst: false,
        isLast: false,
      });
      currentStart += balanced;
      remaining -= balanced;
      break;
    }

    slices.push({
      pageIndex: slices.length,
      sheetNumber: slices.length + 1,
      start: currentStart,
      end: currentStart + pCount,
      isFirst: false,
      isLast: false,
    });
    currentStart += pCount;
    remaining -= pCount;
  }

  if (remaining > 0) {
    slices.push({
      pageIndex: slices.length,
      sheetNumber: slices.length + 1,
      start: currentStart,
      end: totalDataRows,
      isFirst: false,
      isLast: true,
    });
  } else if (slices.length > 0) {
    slices[slices.length - 1].isLast = true;
  }

  return slices;
}

/**
 * Finds a safe row end index <= targetEnd that does not break vertically merged rowSpan groups.
 */
function findSafeRowSplitEnd(rows: any[], startIdx: number, maxRowsToTake: number): number {
  const total = rows.length;
  const desiredEnd = Math.min(total, startIdx + maxRowsToTake);
  if (desiredEnd >= total) return total;

  // Compute the maximum row index covered by any rowSpan starting before desiredEnd
  let boundary = startIdx;
  let lastSafeBoundary = startIdx;

  while (boundary < desiredEnd) {
    let groupEnd = boundary + 1;
    for (let r = boundary; r < groupEnd && r < total; r++) {
      const row = rows[r];
      if (!row) continue;

      if (row.cellSpans && typeof row.cellSpans === "object") {
        for (const span of Object.values(row.cellSpans) as any[]) {
          const rs = Number(span?.rowSpan) || 1;
          if (rs > 1) groupEnd = Math.max(groupEnd, r + rs);
        }
      }

      if (Array.isArray(row)) {
        for (const cell of row) {
          const rs = Number(cell?.rowSpan) || 1;
          if (rs > 1) groupEnd = Math.max(groupEnd, r + rs);
        }
      }
    }

    if (groupEnd <= desiredEnd || lastSafeBoundary === startIdx) {
      lastSafeBoundary = Math.min(total, groupEnd);
      boundary = lastSafeBoundary;
    } else {
      break;
    }
  }

  return Math.max(startIdx + 1, lastSafeBoundary);
}

interface PendingBlockState {
  block: any;
  rowOffset: number;
  childOffsets?: number[];
}

function getPendingBlockRemainingRows(item: PendingBlockState): number {
  const b = item.block;
  if (isSplittableTableBlock(b) && !isHorizontalTableBlock(b) && Array.isArray(b.rows)) {
    return Math.max(0, b.rows.length - item.rowOffset);
  }
  if (b.type === "split_row" && Array.isArray(b.children)) {
    return b.children.reduce((maxRem: number, child: any, idx: number) => {
      if (child && isSplittableTableBlock(child) && !isHorizontalTableBlock(child) && Array.isArray(child.rows)) {
        const off = item.childOffsets?.[idx] ?? 0;
        return Math.max(maxRem, child.rows.length - off);
      }
      return maxRem;
    }, 0);
  }
  return 0;
}

function estimatePendingBlockUnits(item: PendingBlockState): number {
  const b = item.block;
  if (!b || typeof b !== "object") return 0;

  if (!isSplittableTableBlock(b) && b.type !== "split_row") {
    return estimateSingleBlockUnits(b);
  }
  if (isHorizontalTableBlock(b)) {
    return estimateSingleBlockUnits(b);
  }
  if (b.type === "split_row" && Array.isArray(b.children)) {
    return b.children.reduce((maxU: number, child: any, idx: number) => {
      const off = item.childOffsets?.[idx] ?? 0;
      return Math.max(maxU, estimatePendingBlockUnits({ block: child, rowOffset: off }));
    }, 0);
  }
  const remRows = getPendingBlockRemainingRows(item);
  if (item.rowOffset > 0) {
    return getTableHeaderUnits(b) + remRows;
  }
  return getTableHeaderUnits(b) + Math.max(1, remRows);
}

function slicePendingBlockForCapacity(
  item: PendingBlockState,
  remainingUnits: number,
  isEmptyPage: boolean
): { pageBlock: any; usedUnits: number; remainder: PendingBlockState | null } {
  const block = item.block;

  // Non-splittable blocks (diagrams, text notes, horizontal tables)
  if (
    !isSplittableTableBlock(block) &&
    block.type !== "split_row"
  ) {
    const cost = estimateSingleBlockUnits(block);
    if (cost <= remainingUnits || isEmptyPage) {
      return { pageBlock: block, usedUnits: cost, remainder: null };
    }
    return { pageBlock: null, usedUnits: 0, remainder: item };
  }

  if (isHorizontalTableBlock(block)) {
    const cost = estimateSingleBlockUnits(block);
    if (cost <= remainingUnits || isEmptyPage) {
      return { pageBlock: block, usedUnits: cost, remainder: null };
    }
    return { pageBlock: null, usedUnits: 0, remainder: item };
  }

  // Split-row with potential child tables
  if (block.type === "split_row" && Array.isArray(block.children)) {
    const childOffsets = item.childOffsets || block.children.map(() => 0);
    const hasChildTables = block.children.some(
      (c: any) => c && isSplittableTableBlock(c) && !isHorizontalTableBlock(c) && Array.isArray(c.rows)
    );

    if (!hasChildTables) {
      const cost = estimateSingleBlockUnits(block);
      if (cost <= remainingUnits || isEmptyPage) {
        return { pageBlock: block, usedUnits: cost, remainder: null };
      }
      return { pageBlock: null, usedUnits: 0, remainder: item };
    }

    const headerUnits = block.children.reduce(
      (maxH: number, c: any) => Math.max(maxH, isSplittableTableBlock(c) ? getTableHeaderUnits(c) : 0),
      0
    );
    const maxRemRows = getPendingBlockRemainingRows({ block, rowOffset: 0, childOffsets });

    if (maxRemRows === 0) {
      return { pageBlock: block, usedUnits: headerUnits || 1, remainder: null };
    }

    const availableForRows = Math.floor(remainingUnits - headerUnits);
    if (availableForRows < 1 && !isEmptyPage) {
      return { pageBlock: null, usedUnits: 0, remainder: item };
    }

    if (maxRemRows <= availableForRows) {
      const isContinuationSplit = childOffsets.some((off: number) => off > 0);
      const pageChildren = block.children.map((child: any, cIdx: number) => {
        if (!child || !isSplittableTableBlock(child) || isHorizontalTableBlock(child) || !Array.isArray(child.rows)) {
          if (isContinuationSplit && (child?.type === "diagram_block" || child?.type === "diagram")) {
            return { type: "blank" };
          }
          return child;
        }
        const off = childOffsets[cIdx] ?? 0;
        if (off >= child.rows.length) return { type: "blank" };
        if (off === 0) return child;
        return { ...child, __rowIndexOffset: off, rows: child.rows.slice(off) };
      });
      return {
        pageBlock: { ...block, children: pageChildren },
        usedUnits: headerUnits + maxRemRows,
        remainder: null,
      };
    }

    const takeCount = Math.max(1, availableForRows);
    const isContinuationSplit = childOffsets.some((off: number) => off > 0);
    const nextOffsets: number[] = [];
    let anyMore = false;
    let maxTaken = 1;

    const pageChildren = block.children.map((child: any, cIdx: number) => {
      const off = childOffsets[cIdx] ?? 0;
      if (!child || !isSplittableTableBlock(child) || isHorizontalTableBlock(child) || !Array.isArray(child.rows)) {
        nextOffsets.push(off);
        if (isContinuationSplit && (child?.type === "diagram_block" || child?.type === "diagram")) {
          return { type: "blank" };
        }
        return child;
      }
      if (off >= child.rows.length) {
        nextOffsets.push(off);
        return { type: "blank" };
      }
      const end = findSafeRowSplitEnd(child.rows, off, takeCount);
      maxTaken = Math.max(maxTaken, end - off);
      nextOffsets.push(end);
      if (end < child.rows.length) anyMore = true;
      return { ...child, __rowIndexOffset: off, rows: child.rows.slice(off, end) };
    });

    return {
      pageBlock: { ...block, children: pageChildren },
      usedUnits: headerUnits + maxTaken,
      remainder: anyMore ? { block, rowOffset: 0, childOffsets: nextOffsets } : null,
    };
  }

  // Standard vertical table_grid or matrix_table
  const rows: any[] = Array.isArray(block.rows) ? block.rows : [];
  const off = item.rowOffset;
  const remRows = rows.length - off;
  const headerUnits = getTableHeaderUnits(block);

  // Preserve empty placeholder tables when rows array is intentionally empty on original template
  if (rows.length === 0) {
    const cost = headerUnits + 1;
    if (cost <= remainingUnits || isEmptyPage) {
      return { pageBlock: block, usedUnits: cost, remainder: null };
    }
    return { pageBlock: null, usedUnits: 0, remainder: item };
  }

  if (remRows <= 0) {
    return { pageBlock: null, usedUnits: 0, remainder: null };
  }

  const availableForRows = Math.floor(remainingUnits - headerUnits);
  if (availableForRows < 1 && !isEmptyPage) {
    return { pageBlock: null, usedUnits: 0, remainder: item };
  }

  if (remRows <= availableForRows) {
    const pageBlock =
      off === 0
        ? block
        : { ...block, __rowIndexOffset: off, rows: rows.slice(off) };
    return {
      pageBlock,
      usedUnits: headerUnits + remRows,
      remainder: null,
    };
  }

  const takeCount = Math.max(1, availableForRows);
  const splitEnd = findSafeRowSplitEnd(rows, off, takeCount);
  const slicedBlock = {
    ...block,
    __rowIndexOffset: off,
    rows: rows.slice(off, splitEnd),
  };

  return {
    pageBlock: slicedBlock,
    usedUnits: headerUnits + (splitEnd - off),
    remainder: splitEnd < rows.length ? { block, rowOffset: splitEnd } : null,
  };
}

function estimateTotalBlocksUnits(blocks: any[]): number {
  return blocks.reduce((sum, b) => sum + estimateSingleBlockUnits(b), 0);
}

/**
 * Splits canvas layoutBlocks sequentially across physical A4 pages.
 * Ensures multi-table templates render every row of every table without truncation,
 * honors explicit page_break blocks, keeps horizontal tables whole, and avoids
 * leaving empty header-only tables on continuation sheets.
 */
export function paginateCanvasBlocks(
  layoutBlocks: any[] | undefined,
  hasDiagram: boolean = false
): CertificatePageSlice[] {
  if (!layoutBlocks || !Array.isArray(layoutBlocks) || layoutBlocks.length === 0) {
    return [{ pageIndex: 0, sheetNumber: 1, start: 0, end: 0, isFirst: true, isLast: true, blocks: [] }];
  }

  const cap = getSheetCapacities(hasDiagram);

  // Split into explicit segments whenever a user placed a `page_break` block
  const segments: any[][] = [[]];
  for (const block of layoutBlocks) {
    if (!block) continue;
    if (block.type === "page_break") {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(block);
    }
  }
  const nonEmptySegments = segments.filter((seg, idx) => seg.length > 0 || idx === 0);

  // Single-page fast path: no explicit page_break and all blocks fit with signatures on Sheet 1
  if (nonEmptySegments.length === 1) {
    const totalUnits = estimateTotalBlocksUnits(nonEmptySegments[0]);
    const totalRows = countCanvasDataRows(nonEmptySegments[0]);
    if (totalUnits <= cap.singleCapacity) {
      return [
        {
          pageIndex: 0,
          sheetNumber: 1,
          start: 0,
          end: totalRows,
          isFirst: true,
          isLast: true,
          blocks: nonEmptySegments[0],
        },
      ];
    }
  }

  const allPageBlocks: any[][] = [];

  for (let segIdx = 0; segIdx < nonEmptySegments.length; segIdx++) {
    const segBlocks = nonEmptySegments[segIdx];
    const isLastSegment = segIdx === nonEmptySegments.length - 1;
    let queue: PendingBlockState[] = segBlocks.map((block) => ({ block, rowOffset: 0 }));

    while (queue.length > 0) {
      const currentSheetIndex = allPageBlocks.length;
      const isFirstSheet = currentSheetIndex === 0;
      const remainingSegmentUnits = queue.reduce(
        (sum, item) => sum + estimatePendingBlockUnits(item),
        0
      );

      // Compute budget for this sheet:
      // - Last segment's final sheet must also reserve room for uncertainty/remarks/signatures.
      // - If everything remaining in the final segment fits on a continuation sheet WITHOUT signatures
      //   but exceeds finalSheetCapacity, split cleanly into 2 balanced sheets so signatures don't clip.
      let budget = isFirstSheet ? cap.p1Capacity : cap.continuationCapacity;
      if (isLastSegment) {
        const finalLimit = isFirstSheet ? cap.singleCapacity : cap.finalSheetCapacity;
        if (remainingSegmentUnits > finalLimit && remainingSegmentUnits <= budget) {
          budget = Math.max(Math.min(finalLimit, 12), Math.ceil(remainingSegmentUnits / 2));
        }
      }

      const pageBlocks: any[] = [];
      let usedUnits = 0;

      while (queue.length > 0) {
        const nextItem = queue[0];
        const remainingBudget = budget - usedUnits;
        const { pageBlock, usedUnits: consumed, remainder } = slicePendingBlockForCapacity(
          nextItem,
          remainingBudget,
          pageBlocks.length === 0
        );

        if (!pageBlock) {
          // Remaining budget can't fit even the start of the next block; move to next sheet.
          break;
        }

        pageBlocks.push(pageBlock);
        usedUnits += consumed;
        queue.shift();

        if (remainder) {
          queue.unshift(remainder);
          // This sheet is now full (block split at boundary); stop adding further blocks to this sheet.
          break;
        }
      }

      if (pageBlocks.length > 0) {
        allPageBlocks.push(pageBlocks);
      } else if (queue.length > 0) {
        // Failsafe against infinite loop: force emit head block if an unexpected block returned null
        allPageBlocks.push([queue.shift()!.block]);
      }
    }
  }

  if (allPageBlocks.length === 0) {
    allPageBlocks.push([]);
  }

  let runningRowOffset = 0;
  return allPageBlocks.map((blocksForSheet, idx) => {
    const rowCountOnSheet = countCanvasDataRows(blocksForSheet);
    const slice: CertificatePageSlice = {
      pageIndex: idx,
      sheetNumber: idx + 1,
      start: runningRowOffset,
      end: runningRowOffset + rowCountOnSheet,
      isFirst: idx === 0,
      isLast: idx === allPageBlocks.length - 1,
      blocks: blocksForSheet,
    };
    runningRowOffset += rowCountOnSheet;
    return slice;
  });
}

/**
 * Legacy helper maintained for backwards compatibility with existing callers:
 * prefers pre-computed slice.blocks from paginateCanvasBlocks when present.
 */
export function getBlocksForPage(
  blocks: any[] | undefined,
  slice: CertificatePageSlice
): any[] | undefined {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return undefined;
  if (slice.blocks !== undefined) {
    return slice.blocks;
  }

  return blocks
    .map((block) => {
      if (isSplittableTableBlock(block) && block.rows) {
        return {
          ...block,
          rows: block.rows.slice(slice.start, slice.end),
        };
      }

      if (block.type === "split_row" && Array.isArray(block.children)) {
        return {
          ...block,
          children: block.children.map((child: any) => {
            if (child && isSplittableTableBlock(child) && child.rows) {
              return {
                ...child,
                rows: child.rows.slice(slice.start, slice.end),
              };
            }
            if ((child?.type === "diagram_block" || child?.type === "diagram") && !slice.isFirst) {
              return { type: "blank" };
            }
            return child;
          }),
        };
      }

      if ((block.type === "diagram" || block.type === "diagram_block") && !slice.isFirst) {
        return null;
      }
      if (block.type === "notes" && !slice.isLast) {
        return null;
      }

      return block;
    })
    .filter(Boolean);
}
