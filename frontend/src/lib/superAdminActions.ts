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
