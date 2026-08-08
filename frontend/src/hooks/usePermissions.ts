import { useAuth } from "@/lib/auth";
import { RolePermissions } from "@/types/role";

export function usePermissions() {
  const { user } = useAuth();

  const canAccess = (
    moduleKey: string,
    action: "create" | "edit" | "view" | "delete" = "view"
  ): boolean => {
    if (!user) return false;

    // Super Admin platform override
    if (user.isSuperAdmin) return true;

    // Standard un-restricted modules
    if (moduleKey === "dashboard" || moduleKey === "profile") return true;

    // Admin role override
    const roleName = typeof user.role === "string" ? user.role : user.role?.name || "";
    if (roleName.toLowerCase() === "admin") return true;

    // Retrieve role permissions object
    const rolePermissions: RolePermissions | undefined =
      user.userRole?.permissions || (typeof user.role === "object" ? user.role?.permissions : undefined);

    if (rolePermissions && rolePermissions[moduleKey]) {
      return !!rolePermissions[moduleKey][action];
    }

    return true;
  };

  return { canAccess };
}
