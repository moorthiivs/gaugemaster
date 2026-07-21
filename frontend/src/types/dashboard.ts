export type DashboardSummary = {
  total: number;
  dueThisMonth: number;
  overdue: number;
  nextCalibrationDate: string | null;
  dueDatesByMonth: { month: string; count: number }[];
  dueSoonList: { id: string; name: string; dueDate: string }[];
  recentActivity: { id: string; name: string; action: string; at: string }[];
};
