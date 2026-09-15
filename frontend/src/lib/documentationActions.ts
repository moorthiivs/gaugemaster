import httpClient from './httpClient';
import {
  CalibrationProcedure,
  CalibrationProcedureHistory,
  GaugeDiagram,
  GaugeDiagramHistory,
  WorkInstruction,
  WorkInstructionHistory,
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

export async function deleteCalibrationProcedure(id: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/calibration-procedures/${id}`);
  return response.data;
}

export async function getCalibrationProcedureHistory(id: string): Promise<CalibrationProcedureHistory[]> {
  const response = await httpClient.get<CalibrationProcedureHistory[]>(`/calibration-procedures/${id}/history`);
  return response.data;
}

// ==========================================
// 2. Gauge Diagrams
// ==========================================

export async function getGaugeDiagrams(params?: { companyId?: string; search?: string }): Promise<GaugeDiagram[]> {
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

export async function deleteGaugeDiagram(id: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/gauge-diagrams/${id}`);
  return response.data;
}

export async function getGaugeDiagramHistory(id: string): Promise<GaugeDiagramHistory[]> {
  const response = await httpClient.get<GaugeDiagramHistory[]>(`/gauge-diagrams/${id}/history`);
  return response.data;
}

// ==========================================
// 3. Work Instructions
// ==========================================

export async function getWorkInstructions(params?: { companyId?: string; search?: string }): Promise<WorkInstruction[]> {
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

export async function deleteWorkInstruction(id: string): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/work-instructions/${id}`);
  return response.data;
}

export async function getWorkInstructionHistory(id: string): Promise<WorkInstructionHistory[]> {
  const response = await httpClient.get<WorkInstructionHistory[]>(`/work-instructions/${id}/history`);
  return response.data;
}
