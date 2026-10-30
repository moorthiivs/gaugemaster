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
  // 1. Strip parenthetical content like "(364D)" to prevent false number extraction
  const clean = freq.replace(/\(.*?\)/g, "").trim().toLowerCase();
  if (!clean) return 12;

  // 2. Specific textual intervals
  if (clean.includes("half") || clean.includes("semi")) return 6;
  if (clean.includes("quarter")) return 3;

  // 3. Year matches: "1 Year", "Once in year", "once in 2years", "2 YRS", "Yearly"
  if (clean.includes("year") || clean.includes("yr") || clean.includes("annu")) {
    const match = clean.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return (num > 0 ? num : 1) * 12;
  }

  // 4. Month matches: "1 MONTH", "6 Months", "Once in 6 months", "monthly"
  if (clean.includes("month") || clean.includes("mo")) {
    const match = clean.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return num > 0 ? num : 1;
  }

  // 5. Week matches
  if (clean.includes("week") || clean.includes("wk")) {
    const match = clean.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return Math.max(1, Math.round((num * 7) / 30));
  }

  // 6. Day matches
  if (clean.includes("day")) {
    const match = clean.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;
    return Math.max(1, Math.round(num / 30));
  }

  // 7. Pure digits fallback
  const match = clean.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val === 1 || val === 2) {
      return val * 12;
    }
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
