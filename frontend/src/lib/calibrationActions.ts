import httpClient from "./httpClient";
import { CalibrationRecord, CalibrationStats, CertificateConfig } from "../types/calibration";

/**
 * API ACTIONS FOR CALIBRATIONS
 * Centralized functions for all calibration-related backend interactions.
 */

/** Create a new calibration record */
export async function createCalibration(data: Partial<CalibrationRecord>): Promise<CalibrationRecord> {
  const res = await httpClient.post("/calibrations", data);
  return res.data;
}

/** List calibrations with filters and pagination */
export async function listCalibrations(params: {
  userId?: string;
  companyId?: string;
  instrumentId?: string;
  calibrationType?: string;
  verdict?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const res = await httpClient.get("/calibrations", { params });
  return res.data;
}

/** Get a single calibration by ID */
export async function getCalibration(id: string): Promise<CalibrationRecord> {
  const res = await httpClient.get(`/calibrations/${id}`);
  return res.data;
}

/** Get calibration history for a specific instrument */
export async function getCalibrationHistory(instrumentId: string): Promise<CalibrationRecord[]> {
  const res = await httpClient.get(`/calibrations/instrument/${instrumentId}`);
  return res.data;
}

/** Get calibration statistics for a user */
export async function getCalibrationStats(userId: string): Promise<CalibrationStats> {
  const res = await httpClient.get(`/calibrations/stats/${userId}`);
  return res.data;
}

/** Preview the next certificate and ULR numbers (without incrementing) */
export async function getNextNumbers(userId: string, companyId: string): Promise<{
  nextCertNumber: string;
  nextUlrNumber: string;
}> {
  const res = await httpClient.get(`/calibrations/next-numbers/${userId}`, {
    params: { companyId },
  });
  return res.data;
}

/**
 * Generate a calibration certificate PDF.
 * Returns a Blob for download.
 * Will return 403 if ULR is not enabled.
 */
export async function generateCertificate(
  calibrationId: string,
  templateId?: string,
): Promise<Blob> {
  const res = await httpClient.post(
    `/calibrations/${calibrationId}/certificate`,
    null,
    {
      params: { templateId },
      responseType: "blob",
    },
  );
  return res.data;
}

/** Download a previously generated certificate */
export async function downloadCertificate(calibrationId: string): Promise<Blob> {
  const res = await httpClient.get(`/calibrations/${calibrationId}/certificate/download`, {
    responseType: "blob",
  });
  return res.data;
}

/** 
 * DRAFT ACTIONS 
 */

/** Get all drafts for user */
export async function getAllDrafts(userId: string) {
  const res = await httpClient.get(`/calibrations/drafts/${userId}`);
  return res.data;
}

/** Get specific draft */
export async function getDraft(id: string) {
  const res = await httpClient.get(`/calibrations/draft/${id}`);
  return res.data;
}

/** Save draft */
export async function saveDraft(userId: string, data: any, draftId?: string) {
  const res = await httpClient.post(`/calibrations/draft`, { userId, data, draftId });
  return res.data;
}

/** Delete draft */
export async function deleteDraft(id: string) {
  const res = await httpClient.delete(`/calibrations/draft/${id}`);
  return res.data;
}
