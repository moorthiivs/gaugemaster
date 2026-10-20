import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSEO } from '@/hooks/useSEO';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Gauge,
  FileCheck2,
  Layers,
  FileText,
  BookOpen,
  Compass,
  Calendar,
  User,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Eye,
  CheckSquare,
  Loader2,
  Archive,
  ArrowRight,
  Trash2,
  XCircle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  getRecoveryStats,
  getRecoveryItems,
  getRecoveryItemIds,
  getRecoveryItemDetail,
  restoreRecord,
  bulkRestoreRecords,
  permanentDeleteRecord,
  bulkPermanentDeleteRecords,
  RecoveryItem,
  RecoveryStats,
} from '@/lib/recoveryActions';

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules', icon: Archive },
  { value: 'instruments', label: 'Instruments', icon: Gauge },
  { value: 'calibrations', label: 'Calibrations', icon: FileCheck2 },
  { value: 'templates', label: 'Templates', icon: Layers },
  { value: 'calibration_procedures', label: 'Procedures', icon: FileText },
  { value: 'work_instructions', label: 'Work Instructions', icon: BookOpen },
  { value: 'gauge_diagrams', label: 'Gauge Diagrams', icon: Compass },
];

export default function RecoveryCenter() {
  useSEO({
    title: 'Recovery Center — GaugeMaster',
    description: 'Centralized Soft Delete & Recovery System',
  });

  const { canAccess } = usePermissions();
  const canRestore = canAccess('recovery', 'edit') || canAccess('recovery', 'delete');
  const canPermanentDelete = canAccess('recovery', 'delete');

  const canRestoreItem = (item: RecoveryItem) => {
    if (!canRestore) return false;
    return canAccess(item.module, 'edit') || canAccess(item.module, 'create') || canAccess(item.module, 'delete');
  };

  const canPermanentDeleteItem = (item: RecoveryItem) => {
    if (!canPermanentDelete) return false;
    return canAccess(item.module, 'delete');
  };

  const [stats, setStats] = useState<RecoveryStats>({
    total: 0,
    instruments: 0,
    calibrations: 0,
    templates: 0,
    calibration_procedures: 0,
    work_instructions: 0,
    gauge_diagrams: 0,
  });

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedModule, setSelectedModule] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletedByFilter, setDeletedByFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selection & Bulk Processing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAllAcrossFilterSelected, setIsAllAcrossFilterSelected] = useState(false);
  const [allFilterItems, setAllFilterItems] = useState<Array<{ id: string; module: string }>>([]);
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  // Bulk Permanent Delete Confirmation & Safety
  const [bulkPermanentDeleteModalOpen, setBulkPermanentDeleteModalOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');

  // Bulk Restore Confirmation
  const [bulkRestoreModalOpen, setBulkRestoreModalOpen] = useState(false);

  // Live Batch Execution Progress Modal
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressType, setProgressType] = useState<'delete' | 'restore'>('delete');
  const [progressTitle, setProgressTitle] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatusText, setProgressStatusText] = useState('');
  const [progressSuccessCount, setProgressSuccessCount] = useState(0);
  const [progressFailedCount, setProgressFailedCount] = useState(0);
  const [progressErrors, setProgressErrors] = useState<Array<{ id: string; module: string; message: string }>>([]);
  const [isProgressRunning, setIsProgressRunning] = useState(false);
  const [isProgressCancelled, setIsProgressCancelled] = useState(false);
  const cancelRequestedRef = useRef(false);

  // Modals for single actions
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetRestoreItem, setTargetRestoreItem] = useState<RecoveryItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [permanentDeleteModalOpen, setPermanentDeleteModalOpen] = useState(false);
  const [targetPermanentDeleteItem, setTargetPermanentDeleteItem] = useState<RecoveryItem | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    item: RecoveryItem;
    conflicts: string[];
    canRestore: boolean;
  } | null>(null);

  const selectedModuleOption = MODULE_OPTIONS.find((m) => m.value === selectedModule);
  const selectedModuleLabel = selectedModuleOption?.label || 'All Trash';

  const effectiveCount = isAllAcrossFilterSelected
    ? (allFilterItems.length || total)
    : selectedIds.length;

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setIsAllAcrossFilterSelected(false);
    setAllFilterItems([]);
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await getRecoveryStats();
      setStats(data);
    } catch {
      // Ignore background stats error
    }
  }, []);

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecoveryItems({
        module: selectedModule,
        search: searchQuery || undefined,
        deletedBy: deletedByFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      if (!isAllAcrossFilterSelected) {
        setSelectedIds([]);
      }
    } catch {
      toast.error('Failed to load items from Recovery Center');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedModule, searchQuery, deletedByFilter, startDate, endDate, page, limit, isAllAcrossFilterSelected]);

  useEffect(() => {
    fetchStats();
    fetchItems();
  }, [fetchStats, fetchItems]);

  // Handle Select All across entire active view/filter
  const handleSelectAllAcrossFilter = async () => {
    try {
      setLoadingAllIds(true);
      const allIds = await getRecoveryItemIds({
        module: selectedModule,
        search: searchQuery || undefined,
        deletedBy: deletedByFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setAllFilterItems(allIds);
      setSelectedIds(allIds.map((i) => i.id));
      setIsAllAcrossFilterSelected(true);
      toast.info(`Selected all ${allIds.length.toLocaleString()} records across ${selectedModuleLabel}.`);
    } catch {
      toast.error('Failed to select all records across view.');
    } finally {
      setLoadingAllIds(false);
    }
  };

  const getSelectedItemsWithModule = useCallback((): Array<{ id: string; module: string }> => {
    if (isAllAcrossFilterSelected && allFilterItems.length > 0) {
      return allFilterItems;
    }
    const map = new Map<string, string>();
    allFilterItems.forEach((i) => map.set(i.id, i.module));
    items.forEach((i) => map.set(i.id, i.module));

    return selectedIds.map((id) => ({
      id,
      module: map.get(id) || (selectedModule !== 'all' ? selectedModule : 'instruments'),
    }));
  }, [isAllAcrossFilterSelected, allFilterItems, items, selectedIds, selectedModule]);

  // Robust Chunked Batch Execution with Live Progress
  const executeBatchOperation = async (
    targetItems: Array<{ id: string; module: string }>,
    type: 'delete' | 'restore',
  ) => {
    if (targetItems.length === 0) return;

    cancelRequestedRef.current = false;
    setProgressModalOpen(true);
    setProgressType(type);
    setProgressTitle(type === 'delete' ? 'Permanently Deleting Records' : 'Restoring Records');
    setProgressCurrent(0);
    setProgressTotal(targetItems.length);
    setProgressPercent(0);
    setProgressSuccessCount(0);
    setProgressFailedCount(0);
    setProgressErrors([]);
    setIsProgressRunning(true);
    setIsProgressCancelled(false);

    const BATCH_SIZE = 50;
    let success = 0;
    let failed = 0;
    const allErrors: Array<{ id: string; module: string; message: string }> = [];

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      if (cancelRequestedRef.current) {
        setIsProgressCancelled(true);
        break;
      }

      const chunk = targetItems.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(targetItems.length / BATCH_SIZE);

      setProgressStatusText(
        `Processing batch ${batchNumber} of ${totalBatches} (${chunk.length} records)...`,
      );

      try {
        if (type === 'delete') {
          const res = await bulkPermanentDeleteRecords(chunk);
          success += res.deletedCount;
          failed += res.failedCount;
          if (res.errors?.length) allErrors.push(...res.errors);
        } else {
          const res = await bulkRestoreRecords(chunk);
          success += res.restoredCount;
          failed += res.failedCount;
          if (res.errors?.length) allErrors.push(...res.errors);
        }
      } catch (err: any) {
        failed += chunk.length;
        allErrors.push({
          id: chunk[0]?.id || 'batch',
          module: chunk[0]?.module || 'all',
          message: err?.response?.data?.message || err?.message || 'Network request failed for batch',
        });
      }

      const processedCount = Math.min(i + BATCH_SIZE, targetItems.length);
      setProgressCurrent(processedCount);
      setProgressSuccessCount(success);
      setProgressFailedCount(failed);
      setProgressErrors([...allErrors]);
      setProgressPercent(Math.round((processedCount / targetItems.length) * 100));

      // Small pause for UI repaint
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    setIsProgressRunning(false);
    setProgressStatusText(
      cancelRequestedRef.current
        ? `Operation stopped. Processed ${success + failed} of ${targetItems.length} records.`
        : `Completed! ${success.toLocaleString()} record(s) processed successfully.`,
    );

    if (success > 0) {
      toast.success(
        type === 'delete'
          ? `Successfully permanently deleted ${success.toLocaleString()} record(s).`
          : `Successfully restored ${success.toLocaleString()} record(s).`,
      );
    }
    if (failed > 0) {
      toast.error(`${failed} record(s) could not be processed.`);
    }

    fetchStats();
    fetchItems();
    handleClearSelection();
  };

  // Handle single restore confirm
  const handleOpenRestoreModal = async (item: RecoveryItem) => {
    setTargetRestoreItem(item);
    setRestoreModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!targetRestoreItem) return;
    setRestoring(true);
    try {
      const res = await restoreRecord(targetRestoreItem.module, targetRestoreItem.id);
      toast.success(res.message || 'Record restored successfully!');
      setRestoreModalOpen(false);
      setTargetRestoreItem(null);
      fetchStats();
      fetchItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to restore record');
    } finally {
      setRestoring(false);
    }
  };

  // Handle inspect detail
  const handleOpenDetailModal = async (item: RecoveryItem) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const data = await getRecoveryItemDetail(item.module, item.id);
      setDetailData(data);
    } catch {
      toast.error('Failed to load record details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle single permanent delete
  const handleOpenPermanentDeleteModal = (item: RecoveryItem) => {
    setTargetPermanentDeleteItem(item);
    setPermanentDeleteModalOpen(true);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!targetPermanentDeleteItem) return;
    setPermanentDeleting(true);
    try {
      const res = await permanentDeleteRecord(
        targetPermanentDeleteItem.module,
        targetPermanentDeleteItem.id,
      );
      toast.success(res.message || 'Record permanently deleted.');
      setPermanentDeleteModalOpen(false);
      setTargetPermanentDeleteItem(null);
      setSelectedIds((prev) => prev.filter((id) => id !== targetPermanentDeleteItem.id));
      fetchStats();
      fetchItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to permanently delete record');
    } finally {
      setPermanentDeleting(false);
    }
  };

  const isPageAllSelected =
    items.length > 0 &&
    items.every((i) => isAllAcrossFilterSelected || selectedIds.includes(i.id));

  const isPagePartiallySelected =
    !isPageAllSelected &&
    items.some((i) => isAllAcrossFilterSelected || selectedIds.includes(i.id));

  const toggleSelectAll = () => {
    if (isAllAcrossFilterSelected || isPageAllSelected) {
      handleClearSelection();
    } else {
      setSelectedIds(items.map((i) => i.id));
      setIsAllAcrossFilterSelected(false);
      setAllFilterItems([]);
    }
  };

  const toggleSelectItem = (item: RecoveryItem) => {
    if (isAllAcrossFilterSelected) {
      const base = allFilterItems.length > 0 ? allFilterItems.map((i) => i.id) : items.map((i) => i.id);
      setSelectedIds(base.filter((id) => id !== item.id));
      setIsAllAcrossFilterSelected(false);
    } else {
      setSelectedIds((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
      );
    }
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'instruments':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-semibold gap-1 text-[11px]"
          >
            <Gauge className="w-3 h-3" /> Instrument
          </Badge>
        );
      case 'calibrations':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1 text-[11px]"
          >
            <FileCheck2 className="w-3 h-3" /> Calibration
          </Badge>
        );
      case 'templates':
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 font-semibold gap-1 text-[11px]"
          >
            <Layers className="w-3 h-3" /> Template
          </Badge>
        );
      case 'calibration_procedures':
        return (
          <Badge
            variant="outline"
            className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20 font-semibold gap-1 text-[11px]"
          >
            <FileText className="w-3 h-3" /> Procedure
          </Badge>
        );
      case 'work_instructions':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold gap-1 text-[11px]"
          >
            <BookOpen className="w-3 h-3" /> Instruction
          </Badge>
        );
      case 'gauge_diagrams':
        return (
          <Badge
            variant="outline"
            className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 font-semibold gap-1 text-[11px]"
          >
            <Compass className="w-3 h-3" /> Diagram
          </Badge>
        );
      default:
        return <Badge variant="outline">{mod}</Badge>;
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd-MMM-yyyy hh:mm a');
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Recovery Center"
        description="Search, inspect, and safely restore soft-deleted records across all GaugeMaster calibration modules"
        breadcrumbs={[
          { label: 'Administration', href: '/dashboard' },
          { label: 'Recovery Center' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchStats();
                fetchItems();
              }}
              disabled={loading}
              className="gap-1.5 text-xs font-semibold h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {effectiveCount > 0 && canRestore && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (effectiveCount > 50) {
                    setBulkRestoreModalOpen(true);
                  } else {
                    executeBatchOperation(getSelectedItemsWithModule(), 'restore');
                  }
                }}
                disabled={isProgressRunning}
                className="gap-1.5 text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isProgressRunning && progressType === 'restore' ? 'animate-spin' : ''}`} />
                <span>Restore Selected ({effectiveCount.toLocaleString()})</span>
              </Button>
            )}
            {effectiveCount > 0 && canPermanentDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkPermanentDeleteModalOpen(true)}
                disabled={isProgressRunning}
                className="gap-1.5 text-xs font-semibold h-8 shadow-xs transition-all"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isProgressRunning && progressType === 'delete' ? 'animate-spin' : ''}`} />
                <span>Delete Permanently ({effectiveCount.toLocaleString()})</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Module Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <Card
          onClick={() => {
            setSelectedModule('all');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'all'
              ? 'border-primary ring-1 ring-primary bg-primary/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>All Trash</span>
              <Archive className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('instruments');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'instruments'
              ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Instruments</span>
              <Gauge className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.instruments}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('calibrations');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'calibrations'
              ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Calibrations</span>
              <FileCheck2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.calibrations}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('templates');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'templates'
              ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Templates</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.templates}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('calibration_procedures');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'calibration_procedures'
              ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Procedures</span>
              <FileText className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.calibration_procedures}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('work_instructions');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'work_instructions'
              ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Instructions</span>
              <BookOpen className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.work_instructions}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setSelectedModule('gauge_diagrams');
            setPage(1);
            handleClearSelection();
          }}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedModule === 'gauge_diagrams'
              ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-500/5'
              : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Diagrams</span>
              <Compass className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold font-mono mt-1 text-foreground">
              {stats.gauge_diagrams}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID code, certificate number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                  handleClearSelection();
                }}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Module Filter */}
            <div>
              <Select
                value={selectedModule}
                onValueChange={(val) => {
                  setSelectedModule(val);
                  setPage(1);
                  handleClearSelection();
                }}
              >
                <SelectTrigger className="h-9 text-xs font-medium">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deleted By Filter */}
            <div>
              <Input
                placeholder="Deleted by user..."
                value={deletedByFilter}
                onChange={(e) => {
                  setDeletedByFilter(e.target.value);
                  setPage(1);
                  handleClearSelection();
                }}
                className="text-xs h-9"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedModule('all');
                  setSearchQuery('');
                  setDeletedByFilter('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                  handleClearSelection();
                }}
                className="h-9 w-full text-xs font-medium"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Selection Notification Banner */}
      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 text-primary-950 dark:text-primary-100 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap items-center gap-2">
            {isAllAcrossFilterSelected ? (
              <div className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  All <strong className="font-bold underline">{effectiveCount.toLocaleString()}</strong> records across {selectedModuleLabel} are selected.
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  All <strong>{selectedIds.length}</strong> records on this page are selected.
                </span>
                {total > items.length && (
                  <Button
                    variant="link"
                    size="sm"
                    disabled={loadingAllIds}
                    onClick={handleSelectAllAcrossFilter}
                    className="h-auto p-0 font-bold text-primary underline hover:text-primary/80 gap-1.5 text-xs inline-flex items-center"
                  >
                    {loadingAllIds ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>Select all {total.toLocaleString()} records in {selectedModuleLabel}</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* Main Recovery Table */}
      <Card className="shadow-xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={
                      isAllAcrossFilterSelected || isPageAllSelected
                        ? true
                        : isPagePartiallySelected
                        ? 'indeterminate'
                        : false
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  Record Name & Identifier
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  Module
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  Identifying Details
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  Deleted By
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  Deleted At
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-8 bg-muted animate-pulse rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                      <Archive className="w-8 h-8 opacity-40" />
                      <p className="text-sm font-semibold">Recovery Center is empty</p>
                      <p className="text-xs">No deleted records match your active search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isSelected = isAllAcrossFilterSelected || selectedIds.includes(item.id);
                  return (
                    <TableRow
                      key={`${item.module}-${item.id}`}
                      className={`transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
                      }`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectItem(item)}
                          aria-label={`Select ${item.recordName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs text-foreground block">
                            {item.recordName}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground block">
                            {item.identifier}
                          </span>
                          {item.conflictWarning && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {item.conflictWarning}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getModuleBadge(item.module)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.module === 'instruments' && (
                          <span>
                            Make: {item.recordDetails?.make || '—'} | Range:{' '}
                            {item.recordDetails?.range || '—'}
                          </span>
                        )}
                        {item.module === 'calibrations' && (
                          <span>
                            Verdict: <b>{item.recordDetails?.verdict || '—'}</b> | Inst:{' '}
                            {item.recordDetails?.instrument_id_code || '—'}
                          </span>
                        )}
                        {item.module === 'templates' && (
                          <span>
                            Type: {item.recordDetails?.instrument_type || '—'} (v
                            {item.recordDetails?.version || 1})
                          </span>
                        )}
                        {item.module === 'calibration_procedures' && (
                          <span>
                            Doc: {item.recordDetails?.document_name || '—'} (v
                            {item.recordDetails?.version || 1})
                          </span>
                        )}
                        {item.module === 'work_instructions' && (
                          <span>
                            Doc: {item.recordDetails?.document_name || '—'} | Code:{' '}
                            {item.recordDetails?.id_code || '—'}
                          </span>
                        )}
                        {item.module === 'gauge_diagrams' && (
                          <span>
                            Diagram: {item.recordDetails?.document_name || '—'} | Code:{' '}
                            {item.recordDetails?.id_code || '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="w-3.5 h-3.5 text-primary" />
                          <span>{item.deletedByName || 'System'}</span>
                        </div>
                        {item.deletionReason && (
                          <span className="text-[10px] text-muted-foreground italic block truncate max-w-[150px]">
                            "{item.deletionReason}"
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {fmtDate(item.deletedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetailModal(item)}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-slate-600 hover:text-slate-900"
                            title="Inspect Record Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Button>
                          {canRestoreItem(item) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRestoreModal(item)}
                              className="h-7 px-2.5 text-xs font-bold gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-500/30"
                              title="Restore this record"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </Button>
                          )}
                          {canPermanentDeleteItem(item) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPermanentDeleteModal(item)}
                              className="h-7 px-2.5 text-xs font-bold gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-500/30"
                              title="Permanently delete this record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enhanced Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong>{total === 0 ? 0 : (page - 1) * limit + 1}</strong> to{' '}
              <strong>{Math.min(page * limit, total)}</strong> of{' '}
              <strong>{total}</strong> deleted records
            </span>
            <div className="flex items-center gap-1 ml-3">
              <span>Per page:</span>
              <Select
                value={String(limit)}
                onValueChange={(val) => {
                  setLimit(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[65px] h-7 text-xs font-mono font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 text-xs px-2.5 font-medium"
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (
                pNum === 1 ||
                pNum === totalPages ||
                Math.abs(pNum - page) <= 1
              ) {
                return (
                  <Button
                    key={pNum}
                    variant={page === pNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pNum)}
                    className="h-7 w-7 text-xs p-0 font-mono font-bold"
                  >
                    {pNum}
                  </Button>
                );
              }
              if (pNum === 2 && page > 3) return <span key={pNum}>...</span>;
              if (pNum === totalPages - 1 && page < totalPages - 2)
                return <span key={pNum}>...</span>;
              return null;
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 text-xs px-2.5 font-medium"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold">
                Restore {targetRestoreItem?.moduleLabel}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Confirm restoration of <strong>{targetRestoreItem?.recordName}</strong> back to active records.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            {targetRestoreItem?.module === 'instruments' && (
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Coordinated Recovery</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Restoring this instrument will also restore any associated calibration records that were deleted together with it.
                </p>
              </div>
            )}

            {targetRestoreItem?.conflictWarning && (
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Conflict Warning</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {targetRestoreItem.conflictWarning}
                </p>
              </div>
            )}

            <div className="bg-muted p-2.5 rounded-lg space-y-1 font-mono text-[11px]">
              <div><strong>Record:</strong> {targetRestoreItem?.recordName}</div>
              <div><strong>Identifier:</strong> {targetRestoreItem?.identifier}</div>
              <div><strong>Deleted on:</strong> {fmtDate(targetRestoreItem?.deletedAt)}</div>
              {targetRestoreItem?.deletionReason && (
                <div><strong>Reason:</strong> {targetRestoreItem.deletionReason}</div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreModalOpen(false)}
              disabled={restoring}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmRestore}
              disabled={restoring}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>Restore Record</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect Detail Dialog */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Eye className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold">
                Deleted Record Inspection
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Full diagnostic metadata and recovery readiness status
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
            {detailLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : detailData ? (
              <>
                {/* Conflict Banner */}
                {detailData.conflicts.length > 0 ? (
                  <div className="p-3 rounded-lg bg-red-500/10 text-red-800 dark:text-red-300 border border-red-500/20 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Restoration Conflicts Detected</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                      {detailData.conflicts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>This record is healthy and ready to be restored with no conflicts.</span>
                  </div>
                )}

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/60 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Record Name</span>
                    <span className="font-semibold text-foreground">{detailData.item.recordName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Source Module</span>
                    <span className="font-semibold text-foreground">{detailData.item.moduleLabel}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Identifier</span>
                    <span className="font-mono font-semibold text-foreground">{detailData.item.identifier}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Deletion Timestamp</span>
                    <span className="font-mono text-foreground">{fmtDate(detailData.item.deletedAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Deleted By</span>
                    <span className="text-foreground">{detailData.item.deletedByName || 'System'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Deletion Reason</span>
                    <span className="italic text-foreground">{detailData.item.deletionReason || 'None specified'}</span>
                  </div>
                </div>

                {/* Raw Record Dump */}
                <div>
                  <h4 className="font-bold text-xs mb-1.5 text-foreground">Record Attributes</h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 dark:bg-slate-950 rounded-lg text-[10px] font-mono overflow-x-auto max-h-60 leading-relaxed">
                    {JSON.stringify(detailData.item.recordDetails, null, 2)}
                  </pre>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailModalOpen(false)}
              className="text-xs font-semibold"
            >
              Close
            </Button>
            {detailData && canRestore && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setDetailModalOpen(false);
                  handleOpenRestoreModal(detailData.item);
                }}
                disabled={!detailData.canRestore}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Proceed to Restore</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteModalOpen} onOpenChange={setPermanentDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold text-red-600 dark:text-red-400">
                Permanently Delete Record
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1 text-muted-foreground">
              This action cannot be undone. The record and all associated data/files will be permanently erased.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-red-500/10 text-red-800 dark:text-red-300 border border-red-500/20 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Irreversible Database Purge</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                You are about to permanently purge this record from GaugeMaster. Once purged, this record cannot be recovered or restored from any backup audit trail.
              </p>
            </div>

            <div className="bg-muted p-2.5 rounded-lg space-y-1 font-mono text-[11px]">
              <div><strong>Record:</strong> {targetPermanentDeleteItem?.recordName}</div>
              <div><strong>Identifier:</strong> {targetPermanentDeleteItem?.identifier}</div>
              <div><strong>Module:</strong> {targetPermanentDeleteItem?.moduleLabel}</div>
              <div><strong>Deleted on:</strong> {fmtDate(targetPermanentDeleteItem?.deletedAt)}</div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPermanentDeleteModalOpen(false)}
              disabled={permanentDeleting}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmPermanentDelete}
              disabled={permanentDeleting}
              className="text-xs font-bold gap-1.5"
            >
              {permanentDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Permanently Delete</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Permanent Delete Confirmation Dialog */}
      <Dialog
        open={bulkPermanentDeleteModalOpen}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteConfirmText('');
          setBulkPermanentDeleteModalOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-destructive">
                  Permanently Delete {effectiveCount.toLocaleString()} Records
                </DialogTitle>
                <DialogDescription className="text-xs pt-0.5 text-muted-foreground">
                  Irreversible action: selected records will be permanently purged from the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive-foreground border border-destructive/20 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Permanent Database Purge Warning</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                You are about to permanently erase{' '}
                <strong className="text-foreground font-semibold">
                  {effectiveCount.toLocaleString()} record(s)
                </strong>{' '}
                from <strong>{selectedModuleLabel}</strong>. All associated calibration files, histories, and audit records will be irreversibly removed.
              </p>
            </div>

            <div className="bg-muted/70 p-3 rounded-xl space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Scope:</span>
                <span className="font-bold text-foreground">
                  {isAllAcrossFilterSelected ? `All matching ${selectedModuleLabel}` : 'Selected on current page'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total to purge:</span>
                <span className="font-bold text-destructive">{effectiveCount.toLocaleString()} records</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Execution strategy:</span>
                <span className="text-foreground">Managed batch execution (safe 50/batch)</span>
              </div>
            </div>

            {effectiveCount >= 50 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  Type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">DELETE</span> to confirm purge:
                </label>
                <Input
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="h-9 text-xs font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkPermanentDeleteModalOpen(false);
                setBulkDeleteConfirmText('');
              }}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={effectiveCount >= 50 && bulkDeleteConfirmText.trim().toUpperCase() !== 'DELETE'}
              onClick={async () => {
                const targetItems = getSelectedItemsWithModule();
                setBulkPermanentDeleteModalOpen(false);
                setBulkDeleteConfirmText('');
                await executeBatchOperation(targetItems, 'delete');
              }}
              className="text-xs font-bold gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete ({effectiveCount.toLocaleString()})</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Restore Confirmation Dialog */}
      <Dialog open={bulkRestoreModalOpen} onOpenChange={setBulkRestoreModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Restore {effectiveCount.toLocaleString()} Records
                </DialogTitle>
                <DialogDescription className="text-xs pt-0.5 text-muted-foreground">
                  Records will be restored back to their active modules.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to restore{' '}
              <strong className="text-foreground">{effectiveCount.toLocaleString()}</strong> record(s) back into active operations?
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkRestoreModalOpen(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                const targetItems = getSelectedItemsWithModule();
                setBulkRestoreModalOpen(false);
                await executeBatchOperation(targetItems, 'restore');
              }}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore ({effectiveCount.toLocaleString()})</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Batch Execution Progress Modal */}
      <Dialog
        open={progressModalOpen}
        onOpenChange={(open) => {
          if (!open && !isProgressRunning) {
            setProgressModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => { if (isProgressRunning) e.preventDefault(); }}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className={`p-2.5 rounded-xl ${progressType === 'delete' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                {isProgressRunning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : progressErrors.length > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {progressTitle}
                </DialogTitle>
                <DialogDescription className="text-xs pt-0.5 text-muted-foreground">
                  {progressStatusText}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-4 text-xs">
            {/* Progress Bar & Percentage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground font-mono">
                  {progressCurrent.toLocaleString()} / {progressTotal.toLocaleString()} records
                </span>
                <span className="font-bold text-foreground font-mono">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5 rounded-full" />
            </div>

            {/* Live Stats counters */}
            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <div className="text-lg font-bold font-mono">{progressSuccessCount.toLocaleString()}</div>
                <div className="text-[11px] font-medium">Successful</div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                <div className="text-lg font-bold font-mono">{progressFailedCount.toLocaleString()}</div>
                <div className="text-[11px] font-medium">Skipped / Failed</div>
              </div>
            </div>

            {/* Error log if any failed */}
            {progressErrors.length > 0 && (
              <div className="space-y-1">
                <span className="font-semibold text-destructive text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Skipped Records ({progressErrors.length}):
                </span>
                <div className="max-h-28 overflow-y-auto rounded-lg border bg-muted/50 p-2 space-y-1 font-mono text-[10px]">
                  {progressErrors.slice(0, 10).map((err, idx) => (
                    <div key={idx} className="text-destructive/90 truncate">
                      • {err.message}
                    </div>
                  ))}
                  {progressErrors.length > 10 && (
                    <div className="text-muted-foreground italic">
                      + {progressErrors.length - 10} more records skipped
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            {isProgressRunning ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  cancelRequestedRef.current = true;
                  toast.info('Stopping remaining batches...');
                }}
                className="text-xs font-semibold gap-1.5"
              >
                <span>Stop Remaining</span>
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setProgressModalOpen(false)}
                className="text-xs font-bold"
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
