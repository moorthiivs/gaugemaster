/**
 * Canonical Item Status Configuration and Normalization Utilities
 * 
 * Standard statuses in Master Data & Inventory:
 * - Active: In-service / operational instruments
 * - SPARE: Backup / spare instruments in inventory
 * - Inactive: Out-of-service / retired instruments
 * - STOCK: Stored in warehouse / store room stock
 * 
 * Other standard operational statuses:
 * - Scrapped: Decommissioned / disposed
 * - Lost: Untraceable / missing
 * - Under Repair: In maintenance / repair workshop
 * - Rejected: Failed calibration / unusable
 */

export const CANONICAL_ITEM_STATUSES = [
  "Active",
  "SPARE",
  "Inactive",
  "STOCK",
  "Scrapped",
  "Lost",
  "Under Repair",
  "Rejected",
] as const;

export type CanonicalItemStatus = typeof CANONICAL_ITEM_STATUSES[number];

/**
 * Normalizes an item_status string to its canonical casing.
 * Case-insensitively maps:
 * - "active" / "ok" -> "Active"
 * - "spare" -> "SPARE"
 * - "stock" -> "STOCK"
 * - "inactive" -> "Inactive"
 * - "scrapped" -> "Scrapped"
 * - "lost" -> "Lost"
 * - "under repair" / "under_repair" -> "Under Repair"
 * - "rejected" -> "Rejected"
 */
export function normalizeItemStatus(status?: string | null): string {
  if (!status) return "Active";
  const trimmed = status.toString().trim();
  if (!trimmed) return "Active";

  const lower = trimmed.toLowerCase();
  if (lower === "active" || lower === "ok") return "Active";
  if (lower === "spare") return "SPARE";
  if (lower === "stock") return "STOCK";
  if (lower === "inactive") return "Inactive";
  if (lower === "scrapped") return "Scrapped";
  if (lower === "lost") return "Lost";
  if (lower === "under repair" || lower === "under_repair") return "Under Repair";
  if (lower === "rejected") return "Rejected";
  return trimmed;
}

/**
 * Deduplicates an array of item_status strings case-insensitively,
 * normalizing each to its canonical form and preserving uniqueness.
 */
export function deduplicateItemStatuses(statuses: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const s of statuses) {
    if (!s || !s.toString().trim()) continue;
    const normalized = normalizeItemStatus(s);
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Returns clean filter options for the Item Status filter dropdown,
 * ensuring "All" is first and standard master statuses are included without duplicates.
 */
export function getItemStatusFilterList(existingStatuses?: (string | undefined | null)[]): string[] {
  const clean = deduplicateItemStatuses([
    ...(existingStatuses || []),
    "Active",
    "SPARE",
    "Inactive",
    "STOCK",
  ]);
  return ["All", ...clean];
}
