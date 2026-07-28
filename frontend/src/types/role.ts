export interface ModulePermission {
  create: boolean;
  edit: boolean;
  view: boolean;
  delete: boolean;
}

export type RolePermissions = Record<string, ModulePermission>;

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermissions;
  companyId?: string;
  isSystemDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const MODULE_NAMES = [
  { key: 'instruments', label: 'Instruments Inventory', description: 'Access to manage gauge and instrument master records' },
  { key: 'calibrations', label: 'Calibration Workflow', description: 'Access to perform calibrations, view wizard, and generate certificates' },
  { key: 'reports', label: 'Reports & Analytics', description: 'Access to export and view calibration & history reports' },
  { key: 'templates', label: 'Certificate Templates', description: 'Access to design and edit calibration certificate templates' },
  { key: 'users', label: 'User & Role Management', description: 'Access to create users, assign roles, and draw signatures' },
  { key: 'settings', label: 'System Settings', description: 'Access to backup, mail configuration, and system settings' },
];
