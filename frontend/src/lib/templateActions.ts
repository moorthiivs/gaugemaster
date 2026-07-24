import httpClient from "./httpClient";
import { CalibrationTemplate } from "@/types/template";

/**
 * API ACTIONS FOR CALIBRATION TEMPLATES
 */

export async function getTemplates(params?: {
  userId?: string;
  companyId?: string;
  calibrationType?: string;
}): Promise<CalibrationTemplate[]> {
  const res = await httpClient.get("/calibration-templates", { params });
  return res.data;
}

export async function getTemplate(id: string): Promise<CalibrationTemplate> {
  const res = await httpClient.get(`/calibration-templates/${id}`);
  return res.data;
}

export async function createTemplate(
  data: Partial<CalibrationTemplate>,
): Promise<CalibrationTemplate> {
  const res = await httpClient.post("/calibration-templates", data);
  return res.data;
}

export async function updateTemplate(
  id: string,
  data: Partial<CalibrationTemplate>,
): Promise<CalibrationTemplate> {
  const res = await httpClient.put(`/calibration-templates/${id}`, data);
  return res.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await httpClient.delete(`/calibration-templates/${id}`);
}
