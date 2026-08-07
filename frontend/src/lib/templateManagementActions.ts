import httpClient from './httpClient';

export interface ImportPreviewItem {
  name: string;
  instrument_type: string;
  calibration_type: string;
  status: 'NEW' | 'DUPLICATE' | 'INVALID';
  existingId?: string;
  reason?: string;
  spec: any;
}

export interface ImportPreviewResult {
  totalFound: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  manifest: any;
  items: ImportPreviewItem[];
}

export type DuplicateStrategy = 'SKIP' | 'IMPORT_AS_NEW' | 'REPLACE';

export async function exportTemplates(params: {
  templateIds?: string[];
  companyId?: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  const response = await httpClient.post('/calibration-templates/export', params, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/zip' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `calibration-templates-export-${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function validateImportPackage(file: File, companyId?: string): Promise<ImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (companyId) {
    formData.append('companyId', companyId);
  }

  const response = await httpClient.post('/calibration-templates/import/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function importTemplates(params: {
  file: File;
  duplicateStrategy: DuplicateStrategy;
  companyId?: string;
  userId?: string;
  userName?: string;
}): Promise<{ importedCount: number; skippedCount: number; updatedCount: number }> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('duplicateStrategy', params.duplicateStrategy);
  if (params.companyId) formData.append('companyId', params.companyId);
  if (params.userId) formData.append('userId', params.userId);
  if (params.userName) formData.append('userName', params.userName);

  const response = await httpClient.post('/calibration-templates/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}
