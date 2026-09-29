import { addMonths, format, isValid } from "date-fns";

/**
 * Safely parses a date string ("YYYY-MM-DD" or ISO string) into a local Date instance at midnight.
 * Avoids the common UTC midnight rollover issue where Western timezones display previous day.
 */
export function parseLocalDate(dateStr?: string | null): Date | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const cleanStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const parts = cleanStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const fallback = new Date(dateStr);
    return isValid(fallback) ? fallback : undefined;
  }
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return isValid(date) ? date : undefined;
}

/**
 * Parses any human-readable or system frequency string into total months.
 * Examples: "1 MONTH", "6 MONTH", "12 MONTH", "1 Year", "2 Years", "90 Days"
 */
export function parseFrequencyMonths(freq?: string): number {
  if (!freq || typeof freq !== "string") return 12;
  const normalized = freq.trim().toLowerCase();

  if (normalized.includes("half") || normalized.includes("semi")) return 6;
  if (normalized.includes("quarter")) return 3;

  if (normalized.includes("year") || normalized.includes("yr") || normalized.includes("annu")) {
    const match = normalized.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return num * 12;
  }

  if (normalized.includes("month") || normalized.includes("mo")) {
    const match = normalized.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return num;
  }

  if (normalized.includes("week") || normalized.includes("wk")) {
    const match = normalized.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return Math.max(1, Math.round((num * 7) / 30));
  }

  if (normalized.includes("day")) {
    const match = normalized.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return Math.max(1, Math.round(num / 30));
  }

  const match = normalized.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return val > 0 ? val : 12;
  }

  return 12;
}

/**
 * Computes next due date (YYYY-MM-DD) by safely adding frequency months to base calibration date.
 * Uses date-fns addMonths to handle month-end bounds (e.g. Jan 31 -> Feb 28/29) correctly.
 */
export function computeNextDueDate(baseDateStr: string, frequencyStr?: string): string {
  if (!baseDateStr) return "";
  const baseDate = parseLocalDate(baseDateStr);
  if (!baseDate || !isValid(baseDate)) return "";

  const monthsToAdd = parseFrequencyMonths(frequencyStr);
  if (monthsToAdd <= 0) return "";

  const nextDate = addMonths(baseDate, monthsToAdd);
  return format(nextDate, "yyyy-MM-dd");
}

/**
 * Checks whether a given date string is in the past compared to today (at local 00:00:00).
 */
export function isDatePast(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const target = parseLocalDate(dateStr);
  if (!target || !isValid(target)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return target.getTime() < today.getTime();
}
