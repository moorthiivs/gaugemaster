"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Trash2, Mail, Layers, CheckCircle2, Columns } from "lucide-react";
import { useEffect, useState } from "react";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const MASTER_COLUMNS_OPTIONS = [
    { key: "sino", label: "# (S.No)" },
    { key: "name", label: "Device / Gauge Name" },
    { key: "id_code", label: "Gauge ID / Serial No" },
    { key: "location", label: "Location" },
    { key: "module", label: "Department / Module" },
    { key: "due_date", label: "Calibration Due Date" },
    { key: "last_calibration_date", label: "Last Cal. Date" },
    { key: "frequency", label: "Calibration Frequency" },
    { key: "make", label: "Make / Model" },
    { key: "range", label: "Range / Size" },
    { key: "least_count", label: "Least Count" },
    { key: "item_status", label: "Status" },
    { key: "calibration_source", label: "Cal. Source" },
];

export const DEFAULT_BULK_COLUMNS = ["sino", "name", "id_code", "location", "due_date"];

interface FrequencyDialogProps {
    open: boolean;
    onClose: () => void;
    data: any[];
    setData: (val: any[]) => void;
    recipient_role: string;
}

interface MailTimeItem {
    time: string;
}

interface FrequencyForm {
    no_of_mails: number;
    mail_times: MailTimeItem[];
    priority: string;
    when: string;
    reminder_start: number;
    reminder_start_unit: string;
    reminder_field: string;
    mail_template: string;
    /** 'single' = one email per instrument | 'bulk' = all instruments in one grouped email */
    email_mode: 'single' | 'bulk';
    bulk_columns?: string[];
}

export default function FrequencyDialog({
    open,
    onClose,
    data,
    setData,
    recipient_role,
}: FrequencyDialogProps) {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isUpdateing, setisUpdateing] = useState(false);
    const [isDeleting, setisDeleting] = useState(false);

    const [isloading, setisloading] = useState(false);

    const [forms, setForms] = useState<FrequencyForm[]>([
        {
            no_of_mails: 1,
            mail_times: [{ time: "" }],
            priority: "normal",
            when: "before",
            reminder_start: 15,
            reminder_start_unit: "Days",
            reminder_field: "due_date",
            email_mode: "single",
            bulk_columns: ["sino", "name", "id_code", "location", "due_date"],
            mail_template:
                "Hi\n\nThe device {{device_name}} with serial number {{serial_number}} is due for calibration on {{calibration_date}}. Please do the needful.",
        },
    ]);

    // ---------- helper: ensure mail_times is an array ----------
    const ensureMailTimes = (item: any) => {
        if (!item) return [];
        if (Array.isArray(item.mail_times)) return item.mail_times;
        if (typeof item.mail_times === "string") {
            try {
                const parsed = JSON.parse(item.mail_times);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // fallback: try simple string like "16:56"
                return [{ time: item.mail_times }];
            }
        }
        // fallback default
        return [{ time: "" }];
    };

    // ---------- fetch existing frequencies ----------
    const fetchfrequecny = async () => {
        setisloading(true)
        try {
            const params = {
                created_by: user.id,
                companyId: user.companyId,
                recipient_role,
            };
            const res = await httpClient.get("reminder/frequencyData", { params });
            const fetchedData = res.data.map((item: any) => ({
                ...item,
                mail_times: ensureMailTimes(item),
                priority: item.priority ?? "normal",
                bulk_columns: Array.isArray(item.bulk_columns) && item.bulk_columns.length > 0 ? item.bulk_columns : DEFAULT_BULK_COLUMNS,
            }));
            setData(fetchedData);
            if (fetchedData.length > 0) {
                setForms([]);
            }
        } catch (error) {
            console.log(error);
        } finally {
            setisloading(false)
        }
    };

    useEffect(() => {
        fetchfrequecny();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- Column toggles for existing templates ----------
    const toggleExistingBulkColumn = (idx: number, colKey: string) => {
        const updated = [...data];
        const currentCols: string[] = Array.isArray(updated[idx].bulk_columns) && updated[idx].bulk_columns.length > 0
            ? [...updated[idx].bulk_columns]
            : [...DEFAULT_BULK_COLUMNS];

        if (currentCols.includes(colKey)) {
            if (currentCols.length > 1) {
                updated[idx].bulk_columns = currentCols.filter(c => c !== colKey);
            } else {
                toast.error("At least one column must be selected");
                return;
            }
        } else {
            updated[idx].bulk_columns = [...currentCols, colKey];
        }
        setData(updated);
    };

    const setExistingBulkPreset = (idx: number, preset: 'standard' | 'compact' | 'full') => {
        const updated = [...data];
        if (preset === 'compact') {
            updated[idx].bulk_columns = ["sino", "name", "id_code", "due_date"];
        } else if (preset === 'full') {
            updated[idx].bulk_columns = ["sino", "name", "id_code", "location", "module", "due_date", "last_calibration_date", "frequency", "make", "range", "item_status"];
        } else {
            updated[idx].bulk_columns = ["sino", "name", "id_code", "location", "due_date"];
        }
        setData(updated);
    };

    // ---------- Column toggles for new form templates ----------
    const toggleFormBulkColumn = (formIdx: number, colKey: string) => {
        const updated = [...forms];
        const currentCols: string[] = Array.isArray(updated[formIdx].bulk_columns) && updated[formIdx].bulk_columns.length > 0
            ? [...updated[formIdx].bulk_columns]
            : [...DEFAULT_BULK_COLUMNS];

        if (currentCols.includes(colKey)) {
            if (currentCols.length > 1) {
                updated[formIdx].bulk_columns = currentCols.filter(c => c !== colKey);
            } else {
                toast.error("At least one column must be selected");
                return;
            }
        } else {
            updated[formIdx].bulk_columns = [...currentCols, colKey];
        }
        setForms(updated);
    };

    const setFormBulkPreset = (formIdx: number, preset: 'standard' | 'compact' | 'full') => {
        const updated = [...forms];
        if (preset === 'compact') {
            updated[formIdx].bulk_columns = ["sino", "name", "id_code", "due_date"];
        } else if (preset === 'full') {
            updated[formIdx].bulk_columns = ["sino", "name", "id_code", "location", "module", "due_date", "last_calibration_date", "frequency", "make", "range", "item_status"];
        } else {
            updated[formIdx].bulk_columns = ["sino", "name", "id_code", "location", "due_date"];
        }
        setForms(updated);
    };

    // ---------- new-template helpers ----------
    const addTemplate = () => {
        setForms([
            ...forms,
            {
                no_of_mails: 1,
                mail_times: [{ time: "" }],
                priority: "normal",
                when: "before",
                reminder_start: 15,
                reminder_start_unit: "Days",
                reminder_field: "due_date",
                email_mode: "single",
                bulk_columns: ["sino", "name", "id_code", "location", "due_date"],
                mail_template:
                    "Hi\n\nThe device {{device_name}} with serial number {{serial_number}} is due for calibration on {{calibration_date}}. Please do the needful.",
            },
        ]);
    };

    const updateForm = (idx: number, key: string, value: any) => {
        const updated = [...forms];
        (updated[idx] as any)[key] = value;
        setForms(updated);
    };

    const updateMailTime = (idx: number, mailIndex: number, key: string, value: any) => {
        const updated = [...forms];
        updated[idx].mail_times[mailIndex][key] = value;
        setForms(updated);
    };

    const updateMailCountForNew = (idx: number, count: number) => {
        const updated = [...forms];
        const oldTimes = updated[idx].mail_times;
        if (count > oldTimes.length) {
            for (let i = oldTimes.length; i < count; i++) oldTimes.push({ time: "" });
        } else if (count < oldTimes.length) {
            updated[idx].mail_times = oldTimes.slice(0, count);
        }
        updated[idx].no_of_mails = count;
        setForms(updated);
    };

    // ---------- EXISTING item: adjust mail_times when user changes no_of_mails ----------
    const adjustExistingMailCount = (idx: number, count: number) => {
        const updated = [...data];
        // ensure mail_times array exists and is an array
        if (!Array.isArray(updated[idx].mail_times)) {
            updated[idx].mail_times = ensureMailTimes(updated[idx]);
        }
        const oldTimes = updated[idx].mail_times as MailTimeItem[];

        if (count > oldTimes.length) {
            for (let i = oldTimes.length; i < count; i++) {
                oldTimes.push({ time: "" });
            }
        } else if (count < oldTimes.length) {
            updated[idx].mail_times = oldTimes.slice(0, count);
        }

        updated[idx].no_of_mails = count;
        setData(updated);
    };

    const updateExistingMailTime = (idx: number, mailIndex: number, value: string) => {
        const updated = [...data];
        if (!Array.isArray(updated[idx].mail_times)) updated[idx].mail_times = ensureMailTimes(updated[idx]);
        updated[idx].mail_times[mailIndex].time = value;
        setData(updated);
    };

    // ---------- template delete (new form) ----------
    const deletetemplate = (index: number) => {
        setForms(forms.filter((_, idx) => idx !== index));
    };

    // ---------- delete frequency (existing) ----------
    const deleteFrequency = async (id: string) => {
        try {
            setisDeleting(true);
            await httpClient.delete("reminder/deleteReminder", { data: { id } });
            setData(data.filter((f) => f.id !== id));
            toast.success("Frequency deleted successfully!");
        } catch (error) {
            console.log(error);
            toast.error("Failed to delete frequency");
        } finally {
            setisDeleting(false);
        }
    };

    // ---------- submit new templates ----------
    const onSubmitAll = async () => {
        try {
            setIsSaving(true);
            const newItems = forms.map((f) => ({
                id: Date.now() + Math.random(),
                ...f,
                created_by: user.id,
                companyId: user.companyId,
                recipient_role,
            }));
            await httpClient.post("reminder/saveReminder", { items: newItems });
            toast.success("Frequency created successfully!");
            onClose();
        } catch (error) {
            console.log(error);
            toast.error("Failed to create frequencies");
        } finally {
            setIsSaving(false);
        }
    };

    // ---------- update existing freq ----------
    const updateFrequency = async (item: any) => {
        try {
            setisUpdateing(true);
            const payload = {
                ...item,
                created_by: user.id,
                companyId: user.companyId,
                recipient_role,
            };
            await httpClient.put("reminder/updateReminder", payload);
            await fetchfrequecny();
            toast.success("Frequency updated successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to update frequency");
        } finally {
            setisUpdateing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose} >
            <DialogContent className={`max-w-7xl max-h-[90vh] overflow-y-auto ${isSaving ? "opacity-95" : "opacity-100"}`}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Reminder Frequency Settings</DialogTitle>
                </DialogHeader>


                {isloading ? (
                    <>
                        {/* LOADING SKELETON - Existing Templates */}
                        <div className="mt-6 animate-pulse space-y-4">
                            <div className="h-5 bg-gray-300 rounded w-48" />

                            {[1, 2].map((i) => (
                                <Card key={i} className="p-4 border space-y-4">
                                    <div className="h-4 bg-gray-300 rounded w-40" />

                                    <div className="grid grid-cols-6 gap-4">
                                        {Array.from({ length: 6 }).map((_, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <div className="h-3 bg-gray-300 rounded w-24" />
                                                <div className="h-10 bg-gray-200 rounded" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Mail Times */}
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-300 rounded w-32" />
                                        {Array.from({ length: 2 }).map((_, idx) => (
                                            <div key={idx} className="h-10 bg-gray-200 rounded" />
                                        ))}
                                    </div>

                                    {/* Template */}
                                    <div className="h-24 bg-gray-200 rounded" />

                                    <div className="flex justify-end gap-3">
                                        <div className="h-10 w-24 bg-gray-300 rounded" />
                                        <div className="h-10 w-24 bg-gray-300 rounded" />
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* NEW TEMPLATE SKELETON */}
                        <div className="space-y-6 mt-6 animate-pulse">
                            {[1].map((i) => (
                                <Card key={i} className="p-4 border space-y-4">
                                    <div className="h-4 bg-gray-300 w-40 rounded" />

                                    <div className="grid grid-cols-6 gap-4">
                                        {Array.from({ length: 6 }).map((_, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <div className="h-3 bg-gray-300 rounded w-20" />
                                                <div className="h-10 bg-gray-200 rounded" />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-300 rounded w-32" />
                                        <div className="h-10 bg-gray-200 rounded" />
                                    </div>

                                    <div className="h-24 bg-gray-200 rounded" />
                                </Card>
                            ))}
                        </div>

                        {/* FOOTER */}
                        <DialogFooter className="animate-pulse">
                            <div className="h-10 w-36 bg-gray-300 rounded" />
                            <div className="h-10 w-32 bg-gray-300 rounded" />
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        {/* ========== EXISTING (editable) ========== */}
                        <div className="mt-6">
                            <h3 className="font-semibold mb-3">Existing Frequencies (Editable)</h3>

                            {data.length === 0 ? (
                                <div>
                                    <p className="text-sm text-muted-foreground">No frequency added yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {data.map((item, idx) => (
                                        <Card key={item.id} className="p-4 border">
                                            <h2 className="font-semibold mb-3">Existing Template #{idx + 1}</h2>

                                            <div className="grid grid-cols-6 gap-4">
                                                {/* No. of Mails */}
                                                <div>
                                                    <label className="text-sm font-medium">No. of Mails</label>
                                                    <Input
                                                        type="number"
                                                        value={item.no_of_mails}
                                                        min={1}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 1;
                                                            adjustExistingMailCount(idx, val);
                                                        }}
                                                    />
                                                </div>

                                                {/* When */}
                                                <div>
                                                    <label className="text-sm font-medium">Email When</label>
                                                    <Select
                                                        value={item.when}
                                                        onValueChange={(v) => {
                                                            const updated = [...data];
                                                            updated[idx].when = v;
                                                            setData(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="before">Before</SelectItem>
                                                            <SelectItem value="after">After</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Reminder Start */}
                                                <div>
                                                    <label className="text-sm font-medium">Reminder Start</label>
                                                    <Input
                                                        type="number"
                                                        value={item.reminder_start}
                                                        onChange={(e) => {
                                                            const updated = [...data];
                                                            updated[idx].reminder_start = parseInt(e.target.value) || 0;
                                                            setData(updated);
                                                        }}
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div>
                                                    <label className="text-sm font-medium">Unit</label>
                                                    <Select
                                                        value={item.reminder_start_unit}
                                                        onValueChange={(v) => {
                                                            const updated = [...data];
                                                            updated[idx].reminder_start_unit = v;
                                                            setData(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Days">Days</SelectItem>
                                                            <SelectItem value="Week">Week</SelectItem>
                                                            <SelectItem value="Month">Month</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Reminder Field */}
                                                <div>
                                                    <label className="text-sm font-medium">Reminder Field</label>
                                                    <Select
                                                        value={item.reminder_field}
                                                        onValueChange={(v) => {
                                                            const updated = [...data];
                                                            updated[idx].reminder_field = v;
                                                            setData(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="due_date">Due Date</SelectItem>
                                                            <SelectItem value="calibration_date">Calibration Date</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Priority */}
                                                <div>
                                                    <label className="text-xs">Priority</label>
                                                    <Select
                                                        value={item.priority}
                                                        onValueChange={(v) => {
                                                            const updated = [...data];
                                                            updated[idx].priority = v;
                                                            setData(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="normal">Normal</SelectItem>
                                                            <SelectItem value="high">High</SelectItem>
                                                            <SelectItem value="low">Low</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Email Mode — card toggle */}
                                            <div className="mt-3">
                                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Email Mode</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {/* Single card */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [...data];
                                                            updated[idx].email_mode = 'single';
                                                            setData(updated);
                                                        }}
                                                        className={`relative flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                                            (item.email_mode || 'single') === 'single'
                                                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className={`mt-0.5 p-1.5 rounded-lg ${
                                                            (item.email_mode || 'single') === 'single' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                            <Mail className="h-4 w-4" />
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className={`block text-xs font-semibold ${
                                                                (item.email_mode || 'single') === 'single' ? 'text-indigo-700' : 'text-gray-700'
                                                            }`}>Single</span>
                                                            <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">One email per instrument</span>
                                                        </span>
                                                        {(item.email_mode || 'single') === 'single' && (
                                                            <CheckCircle2 className="h-4 w-4 text-indigo-500 absolute top-2 right-2 flex-shrink-0" />
                                                        )}
                                                    </button>

                                                    {/* Bulk card */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [...data];
                                                            updated[idx].email_mode = 'bulk';
                                                            setData(updated);
                                                        }}
                                                        className={`relative flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                                            item.email_mode === 'bulk'
                                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className={`mt-0.5 p-1.5 rounded-lg ${
                                                            item.email_mode === 'bulk' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                            <Layers className="h-4 w-4" />
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className={`block text-xs font-semibold ${
                                                                item.email_mode === 'bulk' ? 'text-emerald-700' : 'text-gray-700'
                                                            }`}>Bulk</span>
                                                            <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">All instruments in one email</span>
                                                        </span>
                                                        {item.email_mode === 'bulk' && (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 absolute top-2 right-2 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Bulk Columns Customizer (Existing) */}
                                                {item.email_mode === 'bulk' && (
                                                    <div className="mt-3 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2.5 animate-in fade-in">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Columns className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                                                    Bulk Email Table Columns ({((item.bulk_columns || DEFAULT_BULK_COLUMNS) as string[]).length} selected)
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExistingBulkPreset(idx, 'compact')}
                                                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                                >
                                                                    Compact
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExistingBulkPreset(idx, 'standard')}
                                                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                                >
                                                                    Standard
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExistingBulkPreset(idx, 'full')}
                                                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                                >
                                                                    Full Details
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {MASTER_COLUMNS_OPTIONS.map((col) => {
                                                                const isSelected = (item.bulk_columns || DEFAULT_BULK_COLUMNS).includes(col.key);
                                                                return (
                                                                    <button
                                                                        key={col.key}
                                                                        type="button"
                                                                        onClick={() => toggleExistingBulkColumn(idx, col.key)}
                                                                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer font-medium ${
                                                                            isSelected
                                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                                                                                : 'bg-white dark:bg-card text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                                                                        }`}
                                                                    >
                                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                                        {col.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* MAIL TIMES */}
                                            <div className="mt-4 space-y-2">
                                                <label className="text-sm font-medium">Mail Times</label>

                                                {(Array.isArray(item.mail_times) ? item.mail_times : ensureMailTimes(item)).map((m: any, mIdx: number) => (
                                                    <div key={mIdx} className="flex items-center gap-3 p-3 bg-gray-100 rounded-md">
                                                        <div className="flex-1">
                                                            <label className="text-xs">Mail {mIdx + 1} Time</label>
                                                            <Input
                                                                type="time"
                                                                value={m?.time || ""}
                                                                onChange={(e) => updateExistingMailTime(idx, mIdx, e.target.value)}
                                                                onClick={(e) => {
                                                                    try {
                                                                        if ("showPicker" in HTMLInputElement.prototype) {
                                                                            (e.target as HTMLInputElement).showPicker();
                                                                        }
                                                                    } catch (err) { }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* TEMPLATE */}
                                            <Card className="p-4 mt-3 bg-yellow-50">
                                                <h3 className="font-semibold text-sm mb-2">Mail Template</h3>
                                                <Textarea
                                                    rows={5}
                                                    value={item.mail_template}
                                                    onChange={(e) => {
                                                        const updated = [...data];
                                                        updated[idx].mail_template = e.target.value;
                                                        setData(updated);
                                                    }}
                                                />
                                            </Card>

                                            {/* DELETE & UPDATE */}
                                            <div className="mt-3 flex justify-end gap-3">
                                                <Button variant="destructive" onClick={() => deleteFrequency(item.id)} disabled={isDeleting}>
                                                    {isDeleting ? "Deleting..." : "Delete"}
                                                </Button>
                                                <Button variant="success" onClick={() => updateFrequency(item)} disabled={isUpdateing}>
                                                    {isUpdateing ? "Updating..." : "Update"}
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ========== NEW TEMPLATES ========== */}
                        <div className="space-y-6 mt-6">
                            {forms.map((form, idx) => (
                                <Card key={idx} className="p-4 border mb-4">
                                    <h2 className="font-semibold mb-3">New Template #{idx + 1}</h2>

                                    <div className="grid grid-cols-6 gap-4">
                                        <div>
                                            <label className="text-sm font-medium">No. of Mails</label>
                                            <Input type="number" min={1} value={form.no_of_mails} onChange={(e) => updateMailCountForNew(idx, parseInt(e.target.value) || 1)} />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Email When</label>
                                            <Select value={form.when} onValueChange={(val) => updateForm(idx, "when", val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="before" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="before">Before</SelectItem>
                                                    <SelectItem value="after">After</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Reminder Start</label>
                                            <Input type="number" value={form.reminder_start} onChange={(e) => updateForm(idx, "reminder_start", parseInt(e.target.value) || 0)} />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Unit</label>
                                            <Select value={form.reminder_start_unit} onValueChange={(val) => updateForm(idx, "reminder_start_unit", val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Unit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Days">Days</SelectItem>
                                                    <SelectItem value="Week">Week</SelectItem>
                                                    <SelectItem value="Month">Month</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Reminder Field</label>
                                            <Select value={form.reminder_field} onValueChange={(val) => updateForm(idx, "reminder_field", val)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="due_date">Due Date</SelectItem>
                                                    <SelectItem value="calibration_date">Calibration Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Priority</label>
                                            <Select value={form.priority} onValueChange={(val) => updateForm(idx, "priority", val)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="high">High</SelectItem>
                                                    <SelectItem value="low">Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Email Mode — card toggle */}
                                    <div className="mt-3">
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Email Mode</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Single card */}
                                            <button
                                                type="button"
                                                onClick={() => updateForm(idx, "email_mode", "single")}
                                                className={`relative flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                                    (form.email_mode || 'single') === 'single'
                                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <span className={`mt-0.5 p-1.5 rounded-lg ${
                                                    (form.email_mode || 'single') === 'single' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    <Mail className="h-4 w-4" />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className={`block text-xs font-semibold ${
                                                        (form.email_mode || 'single') === 'single' ? 'text-indigo-700' : 'text-gray-700'
                                                    }`}>Single</span>
                                                    <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">One email per instrument</span>
                                                </span>
                                                {(form.email_mode || 'single') === 'single' && (
                                                    <CheckCircle2 className="h-4 w-4 text-indigo-500 absolute top-2 right-2 flex-shrink-0" />
                                                )}
                                            </button>

                                            {/* Bulk card */}
                                            <button
                                                type="button"
                                                onClick={() => updateForm(idx, "email_mode", "bulk")}
                                                className={`relative flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                                    form.email_mode === 'bulk'
                                                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <span className={`mt-0.5 p-1.5 rounded-lg ${
                                                    form.email_mode === 'bulk' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    <Layers className="h-4 w-4" />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className={`block text-xs font-semibold ${
                                                        form.email_mode === 'bulk' ? 'text-emerald-700' : 'text-gray-700'
                                                    }`}>Bulk</span>
                                                    <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">All instruments in one email</span>
                                                </span>
                                                {form.email_mode === 'bulk' && (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 absolute top-2 right-2 flex-shrink-0" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Bulk Columns Customizer (New Form) */}
                                        {form.email_mode === 'bulk' && (
                                            <div className="mt-3 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2.5 animate-in fade-in">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Columns className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                                            Bulk Email Table Columns ({((form.bulk_columns || DEFAULT_BULK_COLUMNS) as string[]).length} selected)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormBulkPreset(idx, 'compact')}
                                                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                        >
                                                            Compact
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormBulkPreset(idx, 'standard')}
                                                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                        >
                                                            Standard
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormBulkPreset(idx, 'full')}
                                                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                                        >
                                                            Full Details
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {MASTER_COLUMNS_OPTIONS.map((col) => {
                                                        const isSelected = (form.bulk_columns || DEFAULT_BULK_COLUMNS).includes(col.key);
                                                        return (
                                                            <button
                                                                key={col.key}
                                                                type="button"
                                                                onClick={() => toggleFormBulkColumn(idx, col.key)}
                                                                className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer font-medium ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                                                                        : 'bg-white dark:bg-card text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                                                                }`}
                                                            >
                                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                                {col.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <label className="text-sm font-medium">Mail Times & Priority</label>

                                        {form.mail_times.map((mt, mailIdx) => (
                                            <div key={mailIdx} className="flex items-center gap-3 bg-muted/20 p-3 rounded-md">
                                                <div className="flex-1">
                                                    <label className="text-xs font-medium block">Mail {mailIdx + 1} Time</label>
                                                    <Input 
                                                        type="time" 
                                                        value={mt.time} 
                                                        onChange={(e) => updateMailTime(idx, mailIdx, "time", e.target.value)} 
                                                        onClick={(e) => {
                                                            try {
                                                                if ("showPicker" in HTMLInputElement.prototype) {
                                                                    (e.target as HTMLInputElement).showPicker();
                                                                }
                                                            } catch (err) { }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Card className="p-4 mt-4 bg-yellow-50 border-yellow-200">
                                        <h3 className="font-semibold text-sm mb-2">Mail Template</h3>
                                        <Textarea rows={6} value={form.mail_template} onChange={(e) => updateForm(idx, "mail_template", e.target.value)} />
                                    </Card>

                                    <div className="flex justify-end p-2">
                                        <Button variant="destructive" size="icon" onClick={() => deletetemplate(idx)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* FOOTER */}
                        <DialogFooter>
                            <Button onClick={onSubmitAll} variant="hero" disabled={isSaving}>
                                {isSaving ? "Saving..." : "Add All Frequencies"}
                            </Button>

                            <Button type="button" variant="secondary" onClick={addTemplate} disabled={isSaving}>
                                + Add Another
                            </Button>
                        </DialogFooter>
                    </>
                )}

            </DialogContent>
        </Dialog>
    );
}
