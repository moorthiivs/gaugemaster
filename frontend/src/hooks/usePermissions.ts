import { useAuth } from "@/lib/auth";
import { RolePermissions } from "@/types/role";

export function usePermissions() {
  const { user } = useAuth();

  const canAccess = (
    moduleKey: string,
    action: "create" | "edit" | "view" | "delete" = "view"
  ): boolean => {
    if (!user) return false;

    // Super Admin platform owner override
    if (user.isSuperAdmin) return true;

    // Standard un-restricted modules
    if (moduleKey === "dashboard" || moduleKey === "profile") return true;

    // Retrieve role permissions matrix object from userRole or role
    const rolePermissions: RolePermissions | undefined =
      user.userRole?.permissions || (typeof user.role === "object" ? user.role?.permissions : undefined);

    // If permissions matrix exists for this module, strictly evaluate it
    if (rolePermissions && rolePermissions[moduleKey] !== undefined) {
      if (moduleKey === "template_import" && (action === "create" || action === "view")) {
        return !!(rolePermissions[moduleKey].create || rolePermissions[moduleKey].view);
      }
      if (moduleKey === "template_export" && (action === "create" || action === "view")) {
        return !!(rolePermissions[moduleKey].view || rolePermissions[moduleKey].create);
      }
      return !!rolePermissions[moduleKey][action];
    }

    // Smart fallback for granular submodules if not yet configured in legacy role
    if (rolePermissions && rolePermissions.templates !== undefined) {
      if (moduleKey === "template_builder") {
        return !!rolePermissions.templates[action];
      }
      if (moduleKey === "template_import") {
        return !!rolePermissions.templates.create;
      }
      if (moduleKey === "template_export") {
        return !!rolePermissions.templates.view;
      }
    }

    // Fallback if permissions matrix is not defined
    const roleName = typeof user.role === "string" ? user.role : user.role?.name || "";
    if (roleName.toLowerCase() === "admin") return true;

    // Deny by default — if no permissions matrix is configured, block access
    return false;
  };

  return { canAccess };
}
