import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { useToast } from "@/hooks/use-toast";
import { Role, RolePermissions, MODULE_NAMES } from "@/types/role";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import {
  Users,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Mail,
  Lock,
  UserCheck,
  FileSignature,
  Building,
  KeyRound,
  PenTool,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface AppUser {
  id: string;
  name: string;
  email: string;
  roleId?: string;
  role?: Role;
  designation?: string;
  signature?: string;
  additionalEmails?: string[];
  companyId?: string;
  createdAt?: string;
}

import { usePermissions } from "@/hooks/usePermissions";

export default function UserManagement() {
  const { user: currentUser, setUser } = useAuth();
  const { canAccess } = usePermissions();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // ── User Modal State ──
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleId, setUserRoleId] = useState("");
  const [userDesignation, setUserDesignation] = useState("");
  const [userSignature, setUserSignature] = useState("");
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [savingUser, setSavingUser] = useState(false);

  // ── Role Modal State ──
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [savingRole, setSavingRole] = useState(false);

  // Delete confirmations
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [currentUser?.companyId]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await httpClient.get<AppUser[]>(`/users?companyId=${currentUser?.companyId || ""}`);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load users list",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const res = await httpClient.get<Role[]>(`/roles?companyId=${currentUser?.companyId || ""}`);
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load roles list",
        variant: "destructive",
      });
    } finally {
      setLoadingRoles(false);
    }
  };

  // ── User Modal Handlers ──
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoleId(roles[0]?.id || "");
    setUserDesignation("");
    setUserSignature("");
    setAdditionalEmailsInput("");
    setAdditionalEmails([]);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (u: AppUser) => {
    setEditingUser(u);
    setUserName(u.name || "");
    setUserEmail(u.email || "");
    setUserPassword("");
    const roleNameStr = typeof u.role === "string" ? u.role : u.role?.name || "";
    const matchedRole = roles.find(
      (r) => r.id === u.roleId || r.id === u.role?.id || r.name.toLowerCase() === roleNameStr.toLowerCase()
    );
    setUserRoleId(matchedRole?.id || u.roleId || u.role?.id || (roles[0]?.id || ""));
    setUserDesignation(u.designation || "");
    setUserSignature(u.signature || "");
    setAdditionalEmails(u.additionalEmails || []);
    setAdditionalEmailsInput("");
    setUserModalOpen(true);
  };

  const handleAddAdditionalEmail = () => {
    const trimmed = additionalEmailsInput.trim();
    if (trimmed && !additionalEmails.includes(trimmed)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }
      setAdditionalEmails((prev) => [...prev, trimmed]);
      setAdditionalEmailsInput("");
    }
  };

  const handleRemoveAdditionalEmail = (email: string) => {
    setAdditionalEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSaveUser = async () => {
    if (!userName.trim() || !userEmail.trim()) {
      toast({
        title: "Missing Fields",
        description: "Name and Email are required.",
        variant: "destructive",
      });
      return;
    }

    setSavingUser(true);
    try {
      const payload = {
        name: userName,
        email: userEmail,
        password: userPassword || undefined,
        roleId: userRoleId || undefined,
        designation: userDesignation || undefined,
        signature: userSignature || undefined,
        additionalEmails,
        companyId: currentUser?.companyId,
      };

      if (editingUser) {
        await httpClient.patch(`/users/${editingUser.id}`, payload);
        toast({ title: "User Updated 🎉", description: `User "${userName}" has been updated.` });
      } else {
        await httpClient.post(`/users`, payload);
        toast({ title: "User Created 🎉", description: `User "${userName}" has been created.` });
      }

      setUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Save Failed",
        description: err.response?.data?.message || "Could not save user details.",
        variant: "destructive",
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await httpClient.delete(`/users/${userToDelete.id}`);
      toast({ title: "User Deleted", description: `User "${userToDelete.name}" was removed.` });
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast({ title: "Delete Error", description: "Failed to delete user.", variant: "destructive" });
    }
  };

  // ── Role Modal Handlers ──
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    // Initialize default permissions structure
    const initPerms: RolePermissions = {};
    MODULE_NAMES.forEach((m) => {
      initPerms[m.key] = { create: true, edit: true, view: true, delete: false };
    });
    setRolePermissions(initPerms);
    setRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: Role) => {
    setEditingRole(r);
    setRoleName(r.name || "");
    setRoleDescription(r.description || "");
    const existingPerms = r.permissions || {};
    const filledPerms: RolePermissions = {};
    MODULE_NAMES.forEach((m) => {
      filledPerms[m.key] = existingPerms[m.key] || { create: false, edit: false, view: false, delete: false };
    });
    setRolePermissions(filledPerms);
    setRoleModalOpen(true);
  };

  const handlePermissionChange = (moduleKey: string, action: "create" | "edit" | "view" | "delete", checked: boolean) => {
    setRolePermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] || { create: false, edit: false, view: false, delete: false }),
        [action]: checked,
      },
    }));
  };

  const handleToggleModuleAll = (moduleKey: string, checked: boolean) => {
    setRolePermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        create: checked,
        edit: checked,
        view: checked,
        delete: checked,
      },
    }));
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast({ title: "Missing Field", description: "Role name is required.", variant: "destructive" });
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        name: roleName,
        description: roleDescription,
        permissions: rolePermissions,
        companyId: currentUser?.companyId,
      };

      if (editingRole) {
        const res = await httpClient.patch(`/roles/${editingRole.id}`, payload);
        const savedRoleData = res.data;
        toast({ title: "Role Updated 🎉", description: `Role "${roleName}" permissions updated.` });

        // Real-time update if currentUser has this role
        const isCurrentRole = currentUser && (
          editingRole.id === currentUser.userRole?.id ||
          editingRole.id === currentUser.role?.id ||
          editingRole.name === currentUser.role ||
          editingRole.name === currentUser.role?.name
        );

        if (isCurrentRole && currentUser) {
          const updatedUser = {
            ...currentUser,
            userRole: savedRoleData || {
              ...(currentUser.userRole || {}),
              id: editingRole.id,
              name: roleName,
              permissions: rolePermissions,
            },
          };
          setUser(updatedUser);
          localStorage.setItem("auth_user", JSON.stringify(updatedUser));
        }
      } else {
        await httpClient.post(`/roles`, payload);
        toast({ title: "Role Created 🎉", description: `Role "${roleName}" created successfully.` });
      }

      setRoleModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Save Failed",
        description: err.response?.data?.message || "Could not save role.",
        variant: "destructive",
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await httpClient.delete(`/roles/${roleToDelete.id}`);
      toast({ title: "Role Deleted", description: `Role "${roleToDelete.name}" was removed.` });
      setRoleToDelete(null);
      fetchRoles();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Delete Failed",
        description: err.response?.data?.message || "Could not delete role.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-6 rounded-2xl border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <UserCheck className="h-7 w-7 text-primary" /> User & Role Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system users, assign roles, define granular module permissions, and draw digital signatures.
          </p>
        </div>

        {canAccess("users", "create") && (
          <div className="flex items-center gap-3">
            <Button onClick={handleOpenCreateUser} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add New User
            </Button>
            <Button onClick={handleOpenCreateRole} variant="outline" className="gap-2 border-primary/30">
              <ShieldCheck className="h-4 w-4 text-primary" /> Create Custom Role
            </Button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-muted/40 rounded-xl">
          <TabsTrigger value="users" className="gap-2 text-xs font-semibold rounded-lg">
            <Users className="h-4 w-4" /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 text-xs font-semibold rounded-lg">
            <ShieldCheck className="h-4 w-4" /> Roles & Permissions ({roles.length})
          </TabsTrigger>
        </TabsList>

        {/* ═════════ USERS TAB CONTENT ═════════ */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> System Users Directory
              </CardTitle>
              <CardDescription className="text-xs">
                List of registered users with role access, designations, additional emails, and digital signatures.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingUsers ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs">Loading users list...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <Users className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-medium">No users found.</p>
                  <Button size="sm" onClick={handleOpenCreateUser} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add First User
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>User Details</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Additional Emails</TableHead>
                        <TableHead>Digital Signature</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u, idx) => (
                        <TableRow key={u.id} className="hover:bg-muted/10">
                          <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{u.name}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {u.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="font-semibold bg-primary/10 text-primary border-primary/20"
                            >
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {u.role?.name || u.roleId || "User"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {u.designation || "—"}
                          </TableCell>
                          <TableCell>
                            {u.additionalEmails && u.additionalEmails.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {u.additionalEmails.map((em, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] bg-background">
                                    {em}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.signature ? (
                              <div className="h-8 w-24 bg-white border rounded p-0.5 flex items-center justify-center">
                                <img src={u.signature} alt="Signature" className="max-h-full max-w-full object-contain" />
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50">
                                <PenTool className="h-3 w-3 mr-1" /> Not Drawn
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canAccess("users", "edit") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenEditUser(u)}
                                  title="Edit User"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              {canAccess("users", "delete") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => setUserToDelete(u)}
                                  title="Delete User"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════ ROLES TAB CONTENT ═════════ */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Role & Permission Profiles
              </CardTitle>
              <CardDescription className="text-xs">
                Configure module-level Create, Edit, View, and Delete access rights for each user role.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRoles ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs">Loading roles list...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {roles.map((r) => (
                    <Card key={r.id} className="border shadow-sm relative flex flex-col justify-between">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-bold flex items-center gap-1.5">
                              {r.name}
                              {r.isSystemDefault && (
                                <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-700">
                                  Default
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {r.description || "No description provided."}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            {canAccess("users", "edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                onClick={() => handleOpenEditRole(r)}
                                title="Edit Role & Permissions"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!r.isSystemDefault && canAccess("users", "delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setRoleToDelete(r)}
                                title="Delete Role"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5 border text-xs">
                          <p className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider">
                            Active Permissions Overview:
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {MODULE_NAMES.map((m) => {
                              const perm = r.permissions?.[m.key];
                              const hasAny = perm?.view || perm?.create || perm?.edit || perm?.delete;
                              return (
                                <div key={m.key} className="flex items-center justify-between py-0.5 border-b last:border-0 border-muted">
                                  <span className="truncate pr-1 text-foreground/80">{m.label.split(" ")[0]}</span>
                                  {hasAny ? (
                                    <span className="text-[10px] font-bold text-green-600">
                                      {[perm?.view && "V", perm?.create && "C", perm?.edit && "E", perm?.delete && "D"].filter(Boolean).join("")}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">None</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═════════ CREATE / EDIT USER DIALOG ═════════ */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserCheck className="h-5 w-5 text-primary" />
              {editingUser ? "Edit User Account" : "Create New User"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fill in user credentials, assign role permissions, specify additional email notifications, and draw signature.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  placeholder="e.g. John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address *</Label>
                <Input
                  type="email"
                  placeholder="e.g. john@gaugemaster.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Password {editingUser && <span className="text-muted-foreground font-normal">(Leave blank to keep unchanged)</span>}
                </Label>
                <Input
                  type="password"
                  placeholder={editingUser ? "••••••••" : "Enter password"}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assign Role *</Label>
                <Select value={userRoleId} onValueChange={setUserRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Designation / Title</Label>
              <Input
                placeholder="e.g. Quality Engineer / Calibration In-Charge"
                value={userDesignation}
                onChange={(e) => setUserDesignation(e.target.value)}
              />
            </div>

            {/* Additional Emails */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Additional Email Addresses (for Alerts)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="Enter email e.g. quality.head@company.com"
                  value={additionalEmailsInput}
                  onChange={(e) => setAdditionalEmailsInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAdditionalEmail())}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddAdditionalEmail}>
                  Add Email
                </Button>
              </div>

              {additionalEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {additionalEmails.map((em) => (
                    <Badge key={em} variant="secondary" className="gap-1 text-xs">
                      {em}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveAdditionalEmail(em)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Signature Drawing Canvas */}
            <div className="border-t pt-3">
              <SignatureCanvas
                value={userSignature}
                onChange={(sigData) => setUserSignature(sigData)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setUserModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={savingUser} className="bg-primary hover:bg-primary/90">
              {savingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingUser ? "Update User" : "Save User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════ CREATE / EDIT ROLE DIALOG ═════════ */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {editingRole ? `Edit Role: ${editingRole.name}` : "Create New Role"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure fine-grained module access rights (Create, Edit, View, Delete) for this user role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role Name *</Label>
                <Input
                  placeholder="e.g. Senior Auditor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description</Label>
                <Input
                  placeholder="e.g. Can view reports and verify calibration records"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Granular Permissions Matrix */}
            <div className="border rounded-xl p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Module Permissions Matrix
                </h4>
                <span className="text-[10px] text-muted-foreground italic">
                  Check boxes to grant specific permissions
                </span>
              </div>

              <Table className="border rounded-lg bg-background">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[40%]">Module</TableHead>
                    <TableHead className="text-center w-[15%]">View</TableHead>
                    <TableHead className="text-center w-[15%]">Create</TableHead>
                    <TableHead className="text-center w-[15%]">Edit</TableHead>
                    <TableHead className="text-center w-[15%]">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULE_NAMES.map((m) => {
                    const perm = rolePermissions[m.key] || { create: false, edit: false, view: false, delete: false };
                    const isAllChecked = perm.view && perm.create && perm.edit && perm.delete;

                    return (
                      <TableRow key={m.key}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {m.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{m.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.view}
                            onCheckedChange={(c) => handlePermissionChange(m.key, "view", !!c)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.create}
                            onCheckedChange={(c) => handlePermissionChange(m.key, "create", !!c)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.edit}
                            onCheckedChange={(c) => handlePermissionChange(m.key, "edit", !!c)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.delete}
                            onCheckedChange={(c) => handlePermissionChange(m.key, "delete", !!c)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={savingRole} className="bg-primary hover:bg-primary/90">
              {savingRole ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingRole ? "Update Role" : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm User Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete user <strong>"{userToDelete?.name}"</strong> ({userToDelete?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <Dialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm Role Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete the role <strong>"{roleToDelete?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRoleToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole}>
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
