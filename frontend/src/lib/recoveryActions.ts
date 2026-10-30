import httpClient from './httpClient';

export interface RecoveryItem {
  id: string;
  module:
    | 'instruments'
    | 'calibrations'
    | 'templates'
    | 'calibration_procedures'
    | 'work_instructions'
    | 'gauge_diagrams'
    | 'standards';
  moduleLabel: string;
  recordName: string;
  identifier: string;
  recordDetails: Record<string, any>;
  deletedAt: string;
  deletedById?: string;
  deletedByName?: string;
  deletionReason?: string;
  deletedWithParentId?: string;
  canRestore: boolean;
  conflictWarning?: string;
}

export interface RecoveryStats {
  total: number;
  instruments: number;
  calibrations: number;
  templates: number;
  calibration_procedures: number;
  work_instructions: number;
  gauge_diagrams: number;
  standards: number;
}

export interface RecoveryQueryParams {
  module?: string;
  search?: string;
  deletedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface RecoveryListResponse {
  items: RecoveryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RecoveryDetailResponse {
  item: RecoveryItem;
  conflicts: string[];
  canRestore: boolean;
}

export interface RestoreResponse {
  success: boolean;
  message: string;
  restoredId: string;
  affectedChildCount?: number;
}

export async function getRecoveryStats(): Promise<RecoveryStats> {
  const res = await httpClient.get<RecoveryStats>('/recovery/stats');
  return res.data;
}

export async function getRecoveryItems(params: RecoveryQueryParams): Promise<RecoveryListResponse> {
  const res = await httpClient.get<RecoveryListResponse>('/recovery', { params });
  return res.data;
}

export async function getRecoveryItemIds(
  params: RecoveryQueryParams,
): Promise<Array<{ id: string; module: string }>> {
  const res = await httpClient.get<Array<{ id: string; module: string }>>('/recovery/ids', { params });
  return res.data;
}

export async function getRecoveryItemDetail(module: string, id: string): Promise<RecoveryDetailResponse> {
  const res = await httpClient.get<RecoveryDetailResponse>(`/recovery/${module}/${id}`);
  return res.data;
}

export async function restoreRecord(module: string, id: string): Promise<RestoreResponse> {
  const res = await httpClient.post<RestoreResponse>(`/recovery/${module}/${id}/restore`);
  return res.data;
}

export async function bulkRestoreRecords(items: Array<{ id: string; module: string }>): Promise<{
  restoredCount: number;
  failedCount: number;
  errors: Array<{ id: string; module: string; message: string }>;
}> {
  const res = await httpClient.post('/recovery/bulk-restore', { items });
  return res.data;
}

export async function permanentDeleteRecord(
  module: string,
  id: string,
): Promise<{ success: boolean; message: string; deletedId?: string }> {
  const res = await httpClient.delete<{ success: boolean; message: string; deletedId?: string }>(
    `/recovery/${module}/${id}/permanent`,
  );
  return res.data;
}

export async function bulkPermanentDeleteRecords(
  items: Array<{ id: string; module: string }>,
): Promise<{
  deletedCount: number;
  failedCount: number;
  errors: Array<{ id: string; module: string; message: string }>;
}> {
  const res = await httpClient.post('/recovery/bulk-permanent-delete', { items });
  return res.data;
}

