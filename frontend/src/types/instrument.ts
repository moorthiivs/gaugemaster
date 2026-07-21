/**
 * INSTRUMENT SCHEMA
 * This type definition matches the backend Instrument entity.
 */
export type Instrument = {
  id: string;
  sino?: string;
  name: string;
  id_code: string;
  location: string;
  last_calibration_date: string; // ISO string
  due_date: string; // ISO string
  frequency: string;
  agency: string;
  status: string;
  item_status?: string;
  range?: string;
  serial_no?: string;
  least_count?: string;
  notes?: string;
  make?: string;
  item_type?: string;
  part_no?: string;
  part_name?: string;
  module?: string;
  calibration_source?: string;
  customer?: string;
  sector?: string;
  criticality_level?: string;
  cert_no?: string;
  remarks?: string;
  gauge_issue_date?: string;
  gauges_received_by?: string;
  gauges_issued_by?: string;
  calibration_procedure?: string;
  traceable?: string;
  is_reference_standard?: boolean;
  companyId?: string;
  certificate_file?: string;
  created_by?: any;
  updated_by?: any;
};

/**
 * DASHBOARD SUMMARY SCHEMA
 */
export type DashboardSummary = {
  total: number;
  dueThisMonth: number;
  overdue: number;
  calibratedCount?: number;
  nextCalibrationDate: string | null;
  dueDatesByMonth: { month: string; plan: number; actual: number }[];
  dueSoonList: { id: string; name: string; dueDate: string }[];
  recentActivity: { id: string; name: string; action: string; at: string }[];
  statusDistribution?: { name: string; value: number }[];
  itemStatusDistribution?: { name: string; value: number }[];
  weeklyCompleted?: { week: string; completed: number }[];
  dailyCompleted?: { day: string; date: string; completed: number }[];
};

/**
 * QUERY PARAMETERS SCHEMA
 */
export type InstrumentQuery = {
  status?: string | "All";
  item_status?: string | "All";
  location?: string | "All";
  frequency?: string | "All";
  search?: string;
  due_date?: string;
  due_date_start?: string;
  due_date_end?: string;
  last_cal_start?: string;
  last_cal_end?: string;
  is_reference_standard?: string; // "true", "false", or "all"
  page?: number;
  pageSize?: number;
  limit?: number;
  createdBy?: string;
};

export interface CalendarInstrument {
  id: string;
  name: string;
  id_code: string;
  due_date: string;
  status: string;
  location: string;
  agency: string;
}

export interface DayData {
  count: number;
  instruments: CalendarInstrument[];
}

export interface CalendarResponse {
  year: number;
  month: number;
  totalCount: number;
  days: Record<number, DayData>;
}
