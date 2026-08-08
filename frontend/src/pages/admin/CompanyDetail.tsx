import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Wrench,
  FileCheck,
  Shield,
  ShieldOff,
  Clock,
  ArrowLeft,
  Save,
  Trash2,
  UserCheck,
  Mail,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getCompanyDetail,
  updateCompany,
  updateCompanyAccess,
  deleteCompany,
  CompanyDetail as CompanyDetailType,
  UpdateCompanyAccessDto,
} from "@/lib/superAdminActions";
import CompanyAccessModal from "@/components/admin/CompanyAccessModal";
import DeleteCompanyConfirmModal from "@/components/admin/DeleteCompanyConfirmModal";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");

  // Modals
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCompanyDetail(id);
      setCompany(data);
      setCompanyName(data.companyName || "");
      setIndustry(data.industry || "");
      setCompanySize(data.companySize || "");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load company details");
      navigate("/super-admin/companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateCompany(id, {
        companyName,
        industry,
        companySize,
      });
      toast.success("Company details updated successfully");
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update company");
    } finally {
      setSaving(false);
    }
  };

  const handleAccessUpdate = async (dto: UpdateCompanyAccessDto) => {
    if (!id) return;
    try {
      await updateCompanyAccess(id, dto);
      toast.success("Company access settings updated");
      setAccessModalOpen(false);
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update access");
    }
  };

  const handleDelete = async (confirmationName: string) => {
    if (!id) return;
    try {
      const result = await deleteCompany(id, confirmationName);
      toast.success(result.message);
      setDeleteModalOpen(false);
      navigate("/super-admin/companies");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete company");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Loading company profile...</p>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg"
            onClick={() => navigate("/super-admin/companies")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {company.companyName}
            </h1>
            <p className="text-xs text-muted-foreground">ID: {company.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
            onClick={() => setAccessModalOpen(true)}
          >
            <Shield className="h-3.5 w-3.5" /> Manage Access
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Company
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/70">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{company.stats?.userCount || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Registered Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{company.stats?.instrumentCount || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Instruments / Gauges</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold">{company.stats?.calibrationCount || 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Calibrations Done</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold capitalize">{company.accessStatus}</p>
              <p className="text-xs text-muted-foreground font-medium">Access Status</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Form + Users Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Company Profile Form */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-border/70">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Edit Company Profile
              </CardTitle>
              <CardDescription className="text-xs">
                Update company metadata and administrative fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Industry</Label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Automotive, Manufacturing, Aerospace"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Company Size</Label>
                  <Input
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    placeholder="e.g. 10-50 employees"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Registered Admin Email</Label>
                  <Input
                    value={company.registeredEmail}
                    disabled
                    className="h-8 text-xs bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Registration Date</Label>
                  <Input
                    value={company.createdAt ? format(new Date(company.createdAt), "PPP") : "N/A"}
                    disabled
                    className="h-8 text-xs bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <Button type="submit" size="sm" className="w-full gap-1.5 font-bold mt-2" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving Changes..." : "Save Profile Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Associated Users Table */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="border-border/70">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Associated Users ({company.users?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">
                  All user accounts linked to this company ID.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-bold">User</TableHead>
                    <TableHead className="text-xs font-bold">Role</TableHead>
                    <TableHead className="text-xs font-bold">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.users?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-xs text-muted-foreground">
                        No users registered under this company.
                      </TableCell>
                    </TableRow>
                  ) : (
                    company.users?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-xs">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {u.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {u.role?.name || u.roleId || "User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Access Modal */}
      <CompanyAccessModal
        open={accessModalOpen}
        onOpenChange={setAccessModalOpen}
        company={company}
        onSave={handleAccessUpdate}
      />

      {/* Delete Modal */}
      <DeleteCompanyConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        company={company}
        onConfirm={handleDelete}
      />
    </div>
  );
}
