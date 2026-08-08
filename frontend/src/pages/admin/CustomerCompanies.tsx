import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  Search,
  Users,
  Wrench,
  FileCheck,
  Shield,
  ShieldOff,
  Clock,
  Trash2,
  Eye,
  Pencil,
  RefreshCw,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listCompanies,
  updateCompanyAccess,
  deleteCompany,
  CompanyListItem,
  UpdateCompanyAccessDto,
} from "@/lib/superAdminActions";
import CompanyAccessModal from "@/components/admin/CompanyAccessModal";
import DeleteCompanyConfirmModal from "@/components/admin/DeleteCompanyConfirmModal";

export default function CustomerCompanies() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const navigate = useNavigate();

  // Access modal state
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<CompanyListItem | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyListItem | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filteredCompanies = useMemo(() => {
    let filtered = companies;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.companyName?.toLowerCase().includes(q) ||
          c.registeredEmail?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") {
      filtered = filtered.filter((c) => c.accessStatus === statusFilter);
    }
    return filtered;
  }, [companies, searchQuery, statusFilter]);

  const getAccessBadge = (company: CompanyListItem) => {
    const status = company.accessStatus || "enabled";
    if (status === "enabled") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs">
          <Shield className="h-3 w-3 mr-1" /> Enabled
        </Badge>
      );
    }
    if (status === "disabled") {
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-semibold text-xs">
          <ShieldOff className="h-3 w-3 mr-1" /> Disabled
        </Badge>
      );
    }
    if (status === "time_limited") {
      const expiry = company.accessExpiryDate
        ? format(new Date(company.accessExpiryDate), "dd MMM yyyy")
        : "N/A";
      const isExpired = company.accessExpiryDate
        ? new Date(company.accessExpiryDate) < new Date()
        : false;
      return (
        <Badge
          className={`${
            isExpired
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
              : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
          } font-semibold text-xs`}
        >
          <Clock className="h-3 w-3 mr-1" />
          {isExpired ? "Expired" : `Until ${expiry}`}
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // Stats cards
  const totalCompanies = companies.length;
  const enabledCount = companies.filter((c) => c.accessStatus === "enabled").length;
  const disabledCount = companies.filter((c) => c.accessStatus === "disabled").length;
  const timeLimitedCount = companies.filter((c) => c.accessStatus === "time_limited").length;

  const handleAccessUpdate = async (dto: UpdateCompanyAccessDto) => {
    if (!accessTarget) return;
    try {
      await updateCompanyAccess(accessTarget.id, dto);
      toast.success(`Access updated for ${accessTarget.companyName}`);
      setAccessModalOpen(false);
      setAccessTarget(null);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update access");
    }
  };

  const handleDelete = async (confirmationName: string) => {
    if (!deleteTarget) return;
    try {
      const result = await deleteCompany(deleteTarget.id, confirmationName);
      toast.success(result.message);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCompanies();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete company");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 text-foreground">
              <Building2 className="h-6 w-6 text-primary" />
              Customer Companies
              {loading && (
                <Loader2 className="h-4 w-4 text-primary animate-spin ml-1" />
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Manage all registered customer companies, access control, and tenant data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
            onClick={fetchCompanies}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{totalCompanies}</p>
              <p className="text-xs text-muted-foreground font-medium">Total Companies</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">{enabledCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Enabled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <ShieldOff className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-red-700 dark:text-red-400">{disabledCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Disabled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">{timeLimitedCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Time Limited</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 bg-card/90 backdrop-blur-md border border-border/70 rounded-xl p-2.5 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by company name, email, industry..."
            className="pl-8 h-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="time_limited">Time Limited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold">Company</TableHead>
                <TableHead className="text-xs font-bold">Industry</TableHead>
                <TableHead className="text-xs font-bold text-center">Users</TableHead>
                <TableHead className="text-xs font-bold text-center">Instruments</TableHead>
                <TableHead className="text-xs font-bold text-center">Calibrations</TableHead>
                <TableHead className="text-xs font-bold">Access</TableHead>
                <TableHead className="text-xs font-bold">Created</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading companies...</p>
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">No companies found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-sm">{company.companyName}</p>
                        <p className="text-xs text-muted-foreground">{company.registeredEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{company.industry || "—"}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-medium">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {company.userCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-medium">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        {company.instrumentCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-medium">
                        <FileCheck className="h-3 w-3 text-muted-foreground" />
                        {company.calibrationCount}
                      </div>
                    </TableCell>
                    <TableCell>{getAccessBadge(company)}</TableCell>
                    <TableCell className="text-xs">
                      {company.createdAt
                        ? format(new Date(company.createdAt), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="View Details"
                          onClick={() => navigate(`/super-admin/companies/${company.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Manage Access"
                          onClick={() => {
                            setAccessTarget(company);
                            setAccessModalOpen(true);
                          }}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Delete Company"
                          onClick={() => {
                            setDeleteTarget(company);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Access Modal */}
      {accessTarget && (
        <CompanyAccessModal
          open={accessModalOpen}
          onOpenChange={(val) => {
            setAccessModalOpen(val);
            if (!val) setAccessTarget(null);
          }}
          company={accessTarget}
          onSave={handleAccessUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteCompanyConfirmModal
          open={deleteModalOpen}
          onOpenChange={(val) => {
            setDeleteModalOpen(val);
            if (!val) setDeleteTarget(null);
          }}
          company={deleteTarget}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
