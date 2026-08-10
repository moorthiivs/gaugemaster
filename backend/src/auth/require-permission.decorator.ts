import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface PermissionMetadata {
  module: string;
  action: 'create' | 'edit' | 'view' | 'delete';
}

/**
 * Decorator to specify the required module permission for a controller method.
 * Used in conjunction with PermissionsGuard.
 *
 * @example @RequirePermission('instruments', 'delete')
 */
export const RequirePermission = (module: string, action: 'create' | 'edit' | 'view' | 'delete') =>
  SetMetadata(PERMISSION_KEY, { module, action } as PermissionMetadata);
