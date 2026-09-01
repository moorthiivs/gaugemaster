import { TableGridBlock } from "@/types/template";

/**
 * Evaluates the effective orientation ("vertical" | "horizontal") of a TableGridBlock.
 * If set explicitly to "vertical" or "horizontal", returns that value.
 * If set to "auto" (or unspecified), dynamically computes the most compact and readable
 * layout for print and PDF generation based on the row count vs data column count.
 */
export function getEffectiveTableOrientation(
  tbl: Partial<TableGridBlock> | null | undefined
): "vertical" | "horizontal" {
  if (!tbl) return "vertical";

  if (tbl.orientation === "horizontal") return "horizontal";
  if (tbl.orientation === "vertical") return "vertical";

  // Auto-evaluation logic:
  // Count active data columns (excluding row index / point number columns)
  const columns = tbl.columns || [];
  const activeCols = columns.filter(
    (c) =>
      c.id !== "point_number" &&
      c.id !== "sl_no" &&
      c.id !== "sino" &&
      c.id !== "slno"
  );
  const rowCount = tbl.rows?.length || 0;

  // If there are 12 or more test points with 4 or fewer data columns (e.g. Plunger Dials, Depth Verniers),
  // horizontal transposed layout prevents multi-page vertical overflows on single A4 sheets.
  if (rowCount >= 12 && activeCols.length <= 4) {
    return "horizontal";
  }

  // For multi-trial tables (e.g. 5 trials) or tables with <= 11 rows, vertical columns are optimal.
  return "vertical";
}

/**
 * Returns a human-friendly recommendation and rationale for the UI inspector.
 */
export function getTableOrientationRecommendation(
  tbl: Partial<TableGridBlock> | null | undefined
): {
  recommended: "vertical" | "horizontal";
  isAutoApplied: boolean;
  reason: string;
} {
  if (!tbl) {
    return {
      recommended: "vertical",
      isAutoApplied: true,
      reason: "Standard column layout",
    };
  }

  const effective = getEffectiveTableOrientation(tbl);
  const rowCount = tbl.rows?.length || 0;
  const activeCols = (tbl.columns || []).filter(
    (c) =>
      c.id !== "point_number" &&
      c.id !== "sl_no" &&
      c.id !== "sino" &&
      c.id !== "slno"
  );

  let reason = "";
  if (rowCount >= 12 && activeCols.length <= 4) {
    reason = `Table has ${rowCount} points with ${activeCols.length} columns. Horizontal layout is recommended to fit single-page A4 print.`;
  } else if (activeCols.length > 4) {
    reason = `Table has ${activeCols.length} data columns. Vertical layout is recommended for readability.`;
  } else {
    reason = `Table has ${rowCount} points. Standard vertical layout fits comfortably.`;
  }

  return {
    recommended: effective,
    isAutoApplied: !tbl.orientation || tbl.orientation === "auto",
    reason,
  };
}
