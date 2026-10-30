import httpClient from './httpClient';
import {
  CalibrationProcedure,
  CalibrationProcedureHistory,
  GaugeDiagram,
  GaugeDiagramHistory,
  WorkInstruction,
  WorkInstructionHistory,
  Standard,
  StandardHistory,
} from '@/types/documentation';

// ==========================================
// 1. Calibration Procedures
// ==========================================

export async function getCalibrationProcedures(params?: { companyId?: string; search?: string }): Promise<CalibrationProcedure[]> {
  const response = await httpClient.get<CalibrationProcedure[]>('/calibration-procedures', { params });
  return response.data;
}

export async function getCalibrationProcedure(id: string): Promise<CalibrationProcedure> {
  const response = await httpClient.get<CalibrationProcedure>(`/calibration-procedures/${id}`);
  return response.data;
}

export async function createCalibrationProcedure(formData: FormData): Promise<CalibrationProcedure> {
  const response = await httpClient.post<CalibrationProcedure>('/calibration-procedures', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateCalibrationProcedure(id: string, formData: FormData): Promise<CalibrationProcedure> {
  const response = await httpClient.put<CalibrationProcedure>(`/calibration-procedures/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteCalibrationProcedure(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/calibration-procedures/${id}`, { params: { reason } });
  return response.data;
}

export async function getCalibrationProcedureHistory(id: string): Promise<CalibrationProcedureHistory[]> {
  const response = await httpClient.get<CalibrationProcedureHistory[]>(`/calibration-procedures/${id}/history`);
  return response.data;
}

// ==========================================
// 2. Gauge Diagrams
// ==========================================

export async function getGaugeDiagrams(params?: {
  companyId?: string;
  search?: string;
  id_code?: string;
  part_name?: string;
  range?: string;
}): Promise<GaugeDiagram[]> {
  const response = await httpClient.get<GaugeDiagram[]>('/gauge-diagrams', { params });
  return response.data;
}

export async function getGaugeDiagram(id: string): Promise<GaugeDiagram> {
  const response = await httpClient.get<GaugeDiagram>(`/gauge-diagrams/${id}`);
  return response.data;
}

export async function createGaugeDiagram(formData: FormData): Promise<GaugeDiagram> {
  const response = await httpClient.post<GaugeDiagram>('/gauge-diagrams', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateGaugeDiagram(id: string, formData: FormData): Promise<GaugeDiagram> {
  const response = await httpClient.put<GaugeDiagram>(`/gauge-diagrams/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteGaugeDiagram(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/gauge-diagrams/${id}`, { params: { reason } });
  return response.data;
}

export async function getGaugeDiagramHistory(id: string): Promise<GaugeDiagramHistory[]> {
  const response = await httpClient.get<GaugeDiagramHistory[]>(`/gauge-diagrams/${id}/history`);
  return response.data;
}

// ==========================================
// 3. Work Instructions
// ==========================================

export async function getWorkInstructions(params?: {
  companyId?: string;
  search?: string;
  id_code?: string;
  part_name?: string;
  range?: string;
}): Promise<WorkInstruction[]> {
  const response = await httpClient.get<WorkInstruction[]>('/work-instructions', { params });
  return response.data;
}

export async function getWorkInstruction(id: string): Promise<WorkInstruction> {
  const response = await httpClient.get<WorkInstruction>(`/work-instructions/${id}`);
  return response.data;
}

export async function createWorkInstruction(formData: FormData): Promise<WorkInstruction> {
  const response = await httpClient.post<WorkInstruction>('/work-instructions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateWorkInstruction(id: string, formData: FormData): Promise<WorkInstruction> {
  const response = await httpClient.put<WorkInstruction>(`/work-instructions/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteWorkInstruction(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/work-instructions/${id}`, { params: { reason } });
  return response.data;
}

export async function getWorkInstructionHistory(id: string): Promise<WorkInstructionHistory[]> {
  const response = await httpClient.get<WorkInstructionHistory[]>(`/work-instructions/${id}/history`);
  return response.data;
}

// ==========================================
// 4. Standards
// ==========================================

export async function getStandards(params?: {
  companyId?: string;
  search?: string;
  standard_type?: string;
}): Promise<Standard[]> {
  const response = await httpClient.get<Standard[]>('/standards', { params });
  return response.data;
}

export async function getStandard(id: string): Promise<Standard> {
  const response = await httpClient.get<Standard>(`/standards/${id}`);
  return response.data;
}

export async function createStandard(formData: FormData): Promise<Standard> {
  const response = await httpClient.post<Standard>('/standards', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateStandard(id: string, formData: FormData): Promise<Standard> {
  const response = await httpClient.put<Standard>(`/standards/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteStandard(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/standards/${id}`, { params: { reason } });
  return response.data;
}

export async function getStandardHistory(id: string): Promise<StandardHistory[]> {
  const response = await httpClient.get<StandardHistory[]>(`/standards/${id}/history`);
  return response.data;
}

export async function getStandardTypes(companyId?: string): Promise<string[]> {
  const response = await httpClient.get<string[]>('/standards/types', { params: { companyId } });
  return response.data;
}
