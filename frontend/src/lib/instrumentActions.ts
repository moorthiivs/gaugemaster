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
export async function getDashboardSummary(userId: string, startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string): Promise<DashboardSummary> {
  const res = await httpClient.get(`/dashboard/${userId}`, {
    params: { startDate, endDate, itemStatus, status, location }
  });
  return res.data;
}

/** Fetch dashboard list for a specific user and type */
export async function getDashboardList(userId: string, listType: string, startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string): Promise<any[]> {
  const res = await httpClient.get(`/dashboard/${userId}/list`, {
    params: { listType, startDate, endDate, itemStatus, status, location }
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
export async function getFilterParams(userId: string) {
  const res = await httpClient.get(`/instruments/filters/${userId}`);
  return res.data;
}
