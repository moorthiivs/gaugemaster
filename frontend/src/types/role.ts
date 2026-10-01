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

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  category: 'Operations' | 'Master Data' | 'Administration';
}

export const MODULE_NAMES: ModuleDefinition[] = [
  // Operations
  {
    key: 'calibrations',
    label: 'Calibration Workflow',
    description: 'Perform instrument calibrations, measurement data entry, and certificate generation',
    category: 'Operations',
  },
  {
    key: 'calibration_approvals',
    label: 'Calibration Approval',
    description: 'Review completed calibration records, verify readings, and issue manager sign-off',
    category: 'Operations',
  },
  {
    key: 'calibration_schedule',
    label: 'Calibration Schedule',
    description: 'Track due dates, calendar view, upcoming schedules, and dispatch alerts',
    category: 'Operations',
  },

  // Master Data
  {
    key: 'instruments',
    label: 'Instruments Inventory',
    description: 'Manage gauge and instrument master records, locations, and specifications',
    category: 'Master Data',
  },
  {
    key: 'templates',
    label: 'Certificate Templates',
    description: 'Browse, import, export, duplicate, and manage calibration certificate templates',
    category: 'Master Data',
  },
  {
    key: 'template_builder',
    label: 'Calibration Template Builder',
    description: 'Visual designer to customize fields, tolerance formulas, and canvas layout',
    category: 'Master Data',
  },
  {
    key: 'template_import',
    label: 'Template Import',
    description: 'Upload, restore, and import reusable calibration template packages (.zip)',
    category: 'Master Data',
  },
  {
    key: 'template_export',
    label: 'Template Export',
    description: 'Export, package, and download calibration templates (.zip)',
    category: 'Master Data',
  },
  {
    key: 'calibration_procedures',
    label: 'Calibration Procedures',
    description: 'Upload and manage standard operating procedures (SOPs) and compliance files',
    category: 'Master Data',
  },
  {
    key: 'work_instructions',
    label: 'Work Instructions',
    description: 'Access step-by-step engineering work instructions and calibration guides',
    category: 'Master Data',
  },
  {
    key: 'gauge_diagrams',
    label: 'Gauge Diagrams',
    description: 'Manage technical blueprint diagrams, drawings, and dimensional schematics',
    category: 'Master Data',
  },

  // Administration
  {
    key: 'reports',
    label: 'Reports & Analytics',
    description: 'Generate audit reports, compliance certificates, and statistical analytics',
    category: 'Administration',
  },
  {
    key: 'users',
    label: 'User & Role Management',
    description: 'Manage user accounts, assign custom roles, and draw digital signatures',
    category: 'Administration',
  },
  {
    key: 'settings',
    label: 'System Settings',
    description: 'Configure company profile, email servers, data backup, and system preferences',
    category: 'Administration',
  },
];

