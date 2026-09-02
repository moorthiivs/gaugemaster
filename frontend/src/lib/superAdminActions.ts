import httpClient from "@/lib/httpClient";

export interface CompanyListItem {
  id: string;
  companyName: string;
  companySize: string;
  industry: string;
  registeredEmail: string;
  role: string;
  accessStatus: string;
  accessStartDate: string | null;
  accessExpiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  instrumentCount: number;
  calibrationCount: number;
}

export interface CompanyDetail extends CompanyListItem {
  users: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    role?: { name: string };
    designation: string;
    createdAt: string;
    updatedAt: string;
    onboarded: boolean;
  }[];
  stats: {
    userCount: number;
    instrumentCount: number;
    calibrationCount: number;
    roleCount: number;
  };
}

export interface UpdateCompanyDto {
  companyName?: string;
  industry?: string;
  companySize?: string;
}

export interface UpdateCompanyAccessDto {
  accessStatus: "enabled" | "disabled" | "time_limited";
  accessStartDate?: string;
  accessExpiryDate?: string;
}

export interface DeleteSummary {
  message: string;
  deleteSummary: Record<string, number>;
}

export async function listCompanies(): Promise<CompanyListItem[]> {
  const res = await httpClient.get("/super-admin/companies");
  return res.data;
}

export async function getCompanyDetail(id: string): Promise<CompanyDetail> {
  const res = await httpClient.get(`/super-admin/companies/${id}`);
  return res.data;
}

export async function updateCompany(id: string, data: UpdateCompanyDto): Promise<any> {
  const res = await httpClient.patch(`/super-admin/companies/${id}`, data);
  return res.data;
}

export async function updateCompanyAccess(id: string, data: UpdateCompanyAccessDto): Promise<any> {
  const res = await httpClient.patch(`/super-admin/companies/${id}/access`, data);
  return res.data;
}

export async function deleteCompany(id: string, confirmationName: string): Promise<DeleteSummary> {
  const res = await httpClient.delete(`/super-admin/companies/${id}`, {
    data: { confirmationName },
  });
  return res.data;
}

export async function getCompanyStats(id: string): Promise<any> {
  const res = await httpClient.get(`/super-admin/companies/${id}/stats`);
  return res.data;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  companyId?: string | null;
  action: string;
  status: 'SUCCESS' | 'FAILED';
  statusCode?: number;
  description?: string;
  resourceType?: string;
  resource: string;
  method?: string;
  ipAddress?: string;
  durationMs?: number;
  details?: any;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string | { name: string };
  };
}

export interface AuditLogQueryOptions {
  limit?: number;
  action?: string;
  status?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getAuditLogs(
  companyId: string,
  options?: AuditLogQueryOptions,
): Promise<AuditLog[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.action) params.append("action", options.action);
  if (options?.status) params.append("status", options.status);
  if (options?.resourceType) params.append("resourceType", options.resourceType);
  if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
  if (options?.dateTo) params.append("dateTo", options.dateTo);
  if (options?.search) params.append("search", options.search);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const res = await httpClient.get(`/audit-logs/company/${companyId}${queryString}`);
  return res.data;
}
