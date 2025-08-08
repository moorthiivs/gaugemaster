export type Instrument = {
  id: string;
  name: string;
  id_code: string;
  location: string;
  last_calibration_date: string; // ISO
  due_date: string; // ISO
  frequency: "Yearly" | "Half-Yearly" | "Quarterly" | "Monthly";
  agency: string;
  status: "OK" | "Overdue";
};

export type DashboardSummary = {
  total: number;
  dueThisMonth: number;
  overdue: number;
  nextCalibrationDate: string | null;
  monthlyUpcoming: { month: string; count: number }[];
  recentActivity: { id: string; name: string; action: string; at: string }[];
};

const DB_KEY = "instruments_db";

function seedIfEmpty() {
  const existing = localStorage.getItem(DB_KEY);
  if (existing) return;
  const today = new Date();
  const sample: Instrument[] = Array.from({ length: 24 }).map((_, i) => {
    const last = new Date(today);
    last.setMonth(today.getMonth() - ((i % 6) + 1));
    const due = new Date(last);
    due.setMonth(last.getMonth() + (i % 2 === 0 ? 12 : 6));
    return {
      id: `${i + 1}`,
      name: `Instrument ${i + 1}`,
      id_code: `INS-${1000 + i}`,
      location: ["Lab A", "Lab B", "Field", "QA Room"][i % 4],
      last_calibration_date: last.toISOString(),
      due_date: due.toISOString(),
      frequency: ["Yearly", "Half-Yearly", "Quarterly"][i % 3] as Instrument["frequency"],
      agency: ["CalibCo", "Metrix", "GaugeWorks"][i % 3],
      status: due < today ? "Overdue" : "OK",
    };
  });
  localStorage.setItem(DB_KEY, JSON.stringify(sample));
}

seedIfEmpty();

function readAll(): Instrument[] {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(items: Instrument[]) {
  localStorage.setItem(DB_KEY, JSON.stringify(items));
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const all = readAll();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const dueThisMonth = all.filter((i) => {
    const due = new Date(i.due_date);
    return due >= startOfMonth && due <= endOfMonth;
  }).length;

  const overdue = all.filter((i) => new Date(i.due_date) < now).length;

  const nextDue = all
    .map((i) => new Date(i.due_date))
    .filter((d) => d >= now)
    .sort((a, b) => +a - +b)[0];

  const monthlyUpcoming = Array.from({ length: 12 }).map((_, idx) => {
    const m = new Date(now.getFullYear(), now.getMonth() + idx, 1);
    const count = all.filter((i) => {
      const d = new Date(i.due_date);
      return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
    }).length;
    return {
      month: m.toLocaleString(undefined, { month: "short" }),
      count,
    };
  });

  const recentActivity = all.slice(0, 10).map((i) => ({
    id: i.id,
    name: i.name,
    action: Math.random() > 0.5 ? "Calibrated" : "Status updated",
    at: new Date(i.last_calibration_date).toISOString(),
  }));

  await new Promise((r) => setTimeout(r, 400));

  return {
    total: all.length,
    dueThisMonth,
    overdue,
    nextCalibrationDate: nextDue ? nextDue.toISOString() : null,
    monthlyUpcoming,
    recentActivity,
  };
}

export type InstrumentQuery = {
  status?: Instrument["status"] | "All";
  location?: string | "All";
  frequency?: Instrument["frequency"] | "All";
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listInstruments(q: InstrumentQuery) {
  const all = readAll();
  let filtered = all;
  if (q.status && q.status !== "All") filtered = filtered.filter((i) => i.status === q.status);
  if (q.location && q.location !== "All") filtered = filtered.filter((i) => i.location === q.location);
  if (q.frequency && q.frequency !== "All") filtered = filtered.filter((i) => i.frequency === q.frequency);
  if (q.search) {
    const s = q.search.toLowerCase();
    filtered = filtered.filter((i) =>
      [i.name, i.id_code, i.location, i.agency].some((f) => f.toLowerCase().includes(s))
    );
  }

  filtered = filtered.sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));

  const page = q.page || 1;
  const pageSize = q.pageSize || 10;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  await new Promise((r) => setTimeout(r, 300));

  return { items, total: filtered.length };
}

export async function getInstrument(id: string) {
  const found = readAll().find((i) => i.id === id) || null;
  await new Promise((r) => setTimeout(r, 200));
  return found;
}

export async function createInstrument(data: Omit<Instrument, "id" | "status">) {
  const items = readAll();
  const id = String(Math.max(0, ...items.map((i) => +i.id)) + 1);
  const status: Instrument["status"] = new Date(data.due_date) < new Date() ? "Overdue" : "OK";
  const created: Instrument = { id, status, ...data };
  items.push(created);
  writeAll(items);
  return created;
}

export async function updateInstrument(id: string, data: Partial<Instrument>) {
  const items = readAll();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Not found");
  const merged = { ...items[idx], ...data } as Instrument;
  merged.status = new Date(merged.due_date) < new Date() ? "Overdue" : "OK";
  items[idx] = merged;
  writeAll(items);
  return merged;
}

export async function deleteInstrument(id: string) {
  const items = readAll().filter((i) => i.id !== id);
  writeAll(items);
  return { success: true };
}

export async function generateReport(from: string, to: string, format: "csv" | "pdf") {
  const all = readAll();
  const start = new Date(from);
  const end = new Date(to);
  const rows = all.filter((i) => {
    const d = new Date(i.due_date);
    return d >= start && d <= end;
  });

  await new Promise((r) => setTimeout(r, 500));

  if (format === "csv") {
    const header = ["name","id_code","location","last_calibration_date","due_date","frequency","agency","status"]; 
    const csv = [header.join(","), ...rows.map((r) => header.map((h) => (r as any)[h]).join(","))].join("\n");
    return new Blob([csv], { type: "text/csv" });
  }
  // pdf stub
  return new Blob(["PDF report stub"], { type: "application/pdf" });
}
