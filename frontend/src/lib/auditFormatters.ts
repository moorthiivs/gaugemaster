import { format, isValid, parseISO } from "date-fns";

/**
 * Human-friendly field labels for audit trail display.
 */
const FIELD_LABELS: Record<string, string> = {
  calibration_date: "Calibration Date",
  calibration_type: "Calibration Type",
  reference_standard_name: "Reference Standard",
  reference_standard_id: "Reference Std. ID",
  reference_standard_traceable_to: "Traceable To",
  reference_standard_validity: "Std. Validity Date",
  reference_standard_range: "Std. Range",
  reference_standard_least_count: "Std. Least Count",
  reference_standards: "Reference Standards",
  environmental_conditions: "Environment",
  calibration_points: "Calibration Data",
  uncertainty: "Uncertainty",
  verdict: "Overall Verdict",
  remarks: "Remarks",
  calibrated_by: "Calibrated By",
  calibrated_by_designation: "Calibrated By (Designation)",
  reviewed_by: "Reviewed By",
  reviewed_by_designation: "Reviewed By (Designation)",
  approved_by: "Approved By",
  approved_by_designation: "Approved By (Designation)",
  next_calibration_date: "Next Calibration Due",
};

/**
 * Returns a user-friendly label for an audit field key.
 */
export function getAuditFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Tries to detect if a string is an ISO date and format it.
 */
function tryFormatDate(val: any): string | null {
  if (typeof val !== "string") return null;
  // Match ISO date patterns: 2026-07-24T00:00:00.000Z or 2026-08-24
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(val)) {
    const d = parseISO(val);
    if (isValid(d)) {
      return format(d, "dd-MMM-yyyy");
    }
  }
  return null;
}

/**
 * Format environmental conditions object into readable text.
 */
function formatEnvironmental(val: any): string {
  if (!val || typeof val !== "object") return String(val ?? "—");
  const parts: string[] = [];
  if (val.temperature) parts.push(`Temp: ${val.temperature}°C`);
  if (val.humidity) parts.push(`Humidity: ${val.humidity}%`);
  if (val.pressure) parts.push(`Pressure: ${val.pressure} hPa`);
  // Handle any other keys
  Object.entries(val).forEach(([k, v]) => {
    if (!["temperature", "humidity", "pressure"].includes(k) && v) {
      parts.push(`${k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${v}`);
    }
  });
  return parts.length > 0 ? parts.join(", ") : "—";
}

/**
 * Format calibration_points array into a human-readable summary.
 */
function formatCalibrationPoints(val: any): string {
  if (!val) return "—";
  if (!Array.isArray(val)) return String(val);
  const count = val.length;
  if (count === 0) return "No data points";

  const passCount = val.filter((p: any) => p.status === "PASS").length;
  const failCount = val.filter((p: any) => p.status === "FAIL").length;

  let summary = `${count} point${count > 1 ? "s" : ""}`;
  if (passCount > 0 || failCount > 0) {
    const parts: string[] = [];
    if (passCount > 0) parts.push(`${passCount} Pass`);
    if (failCount > 0) parts.push(`${failCount} Fail`);
    summary += ` (${parts.join(", ")})`;
  }

  // Show unit from first point if available
  const unit = val[0]?.unit;
  if (unit) summary += ` — Unit: ${unit}`;

  return summary;
}

/**
 * Format reference_standards array into readable text.
 */
function formatReferenceStandards(val: any): string {
  if (!val) return "—";
  if (!Array.isArray(val)) return String(val);
  if (val.length === 0) return "None";
  return val
    .map((std: any, i: number) => {
      const name = std.name || std.reference_standard_name || `Standard ${i + 1}`;
      const id = std.id_code || std.reference_standard_id || "";
      return id ? `${name} (${id})` : name;
    })
    .join(", ");
}

/**
 * Format any audit change value into a human-readable string.
 */
export function formatAuditValue(field: string, value: any): string {
  // Null / undefined / empty
  if (value === null || value === undefined || value === "") return "—";

  // Field-specific formatters
  if (field === "environmental_conditions") return formatEnvironmental(value);
  if (field === "calibration_points") return formatCalibrationPoints(value);
  if (field === "reference_standards") return formatReferenceStandards(value);

  // Date fields
  if (
    field.includes("date") ||
    field.includes("validity")
  ) {
    const formatted = tryFormatDate(value);
    if (formatted) return formatted;
  }

  // Verdict badge text
  if (field === "verdict") {
    if (typeof value === "string") return value.toUpperCase();
  }

  // Generic object fallback
  if (typeof value === "object") {
    // Try to show something useful
    if (Array.isArray(value)) return `${value.length} item${value.length !== 1 ? "s" : ""}`;
    // Key-value summary
    const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
  }

  // Try date detection for any string value
  if (typeof value === "string") {
    const formatted = tryFormatDate(value);
    if (formatted) return formatted;
  }

  return String(value);
}
