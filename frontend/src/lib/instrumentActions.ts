import httpClient from "./httpClient";
import { Instrument, InstrumentQuery, DashboardSummary } from "../types/instrument";

/**
 * API ACTIONS FOR INSTRUMENTS
 * Centralized functions for all instrument-related backend interactions.
 */

/** Fetch a paginated list of instruments based on filters */
export async function listInstruments(q: InstrumentQuery) {
  const res = await httpClient.get("/instruments", { params: q });
  return res.data;
}

/** Fetch details of a single instrument by ID */
export async function getInstrument(id: string): Promise<Instrument> {
  const res = await httpClient.get(`/instruments/${id}`);
  return res.data;
}

/** Create a new instrument record */
export async function createInstrument(data: Partial<Instrument>) {
  const res = await httpClient.post("/instruments", data);
  return res.data;
}

/** Update an existing instrument record */
export async function updateInstrument(id: string, data: Partial<Instrument>) {
  const res = await httpClient.patch(`/instruments/${id}`, data);
  return res.data;
}

/** Delete an instrument record */
export async function deleteInstrument(id: string) {
  const res = await httpClient.delete(`/instruments/${id}`);
  return res.data;
}

/** Bulk delete multiple instrument records */
export async function deleteInstrumentsBulk(ids: string[]) {
  const res = await httpClient.post('/instruments/bulk-delete', { ids });
  return res.data;
}

/** Fetch dashboard statistics for a specific user */
export async function getDashboardSummary(userId: string, startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string, isReferenceStandard?: string, companyId?: string): Promise<DashboardSummary> {
  const res = await httpClient.get(`/dashboard/${userId}`, {
    params: { startDate, endDate, itemStatus, status, location, isReferenceStandard, companyId }
  });
  return res.data;
}

/** Fetch dashboard list for a specific user and type */
export async function getDashboardList(userId: string, listType: string, startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string, companyId?: string): Promise<any[]> {
  const res = await httpClient.get(`/dashboard/${userId}/list`, {
    params: { listType, startDate, endDate, itemStatus, status, location, companyId }
  });
  return res.data;
}

/** Export instruments based on a date range and format */
export async function generateReport(from: string, to: string, format: "csv" | "pdf") {
  const res = await httpClient.get(`/instruments/report`, {
    params: { from, to, format },
    responseType: "blob",
  });
  return res.data;
}

/** Fetch filter parameters (locations, frequencies, etc.) for a user */
export async function getFilterParams(userId: string, companyId?: string) {
  const res = await httpClient.get(`/instruments/filters/${userId}`, {
    params: { companyId }
  });
  return res.data;
}

/** Parse frequency string (e.g., "12 Months", "1 Year", "Once in year", "Once in 6 months", "Quarterly") into total number of months */
export function parseFrequencyMonths(freq: string | undefined | null): number {
  if (!freq) return 0;
  const clean = freq.trim().toLowerCase();
  if (!clean) return 0;

  // 1. Exact or keyword-based text phrases
  if (
    clean.includes("once in year") ||
    clean.includes("once in a year") ||
    clean === "yearly" ||
    clean === "annual" ||
    clean === "annually" ||
    clean === "1 year"
  ) {
    return 12;
  }
  if (
    clean.includes("half yearly") ||
    clean.includes("half-yearly") ||
    clean.includes("semi-annual") ||
    clean.includes("semi annual")
  ) {
    return 6;
  }
  if (clean.includes("quarterly") || clean.includes("once in a quarter") || clean.includes("once in quarter")) {
    return 3;
  }
  if (clean === "monthly" || clean === "once a month" || clean === "once in month" || clean === "1 month") {
    return 1;
  }

  // 2. Numerical extraction (e.g. "once in 6 months", "6 month", "once in 2years", "once in 3 years", "24 months")
  const match = clean.match(/(\d+)/);
  if (match) {
    let val = parseInt(match[1], 10);
    if (clean.includes("year")) {
      val *= 12;
    }
    return val;
  }

  // 3. Fallback semantic checks
  if (clean.includes("year")) {
    return 12;
  }
  if (clean.includes("month")) {
    return 1;
  }

  return 0;
}

