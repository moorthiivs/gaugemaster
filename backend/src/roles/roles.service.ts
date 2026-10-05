import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RolePermissions } from './role.entity';
import { User } from '../users/user.entity';
import { Company } from '../company/entities/company.entity';

export const DEFAULT_MODULES = [
  // Operations
  'calibrations',
  'calibration_approvals',
  'calibration_schedule',
  // Master Data
  'instruments',
  'templates',
  'template_builder',
  'template_import',
  'template_export',
  'calibration_procedures',
  'work_instructions',
  'gauge_diagrams',
  // Administration
  'reports',
  'users',
  'settings',
];

const FULL_ACCESS_PERMISSIONS: RolePermissions = {
  calibrations: { create: true, edit: true, view: true, delete: true },
  calibration_approvals: { create: true, edit: true, view: true, delete: true },
  calibration_schedule: { create: true, edit: true, view: true, delete: true },
  instruments: { create: true, edit: true, view: true, delete: true },
  templates: { create: true, edit: true, view: true, delete: true },
  template_builder: { create: true, edit: true, view: true, delete: true },
  template_import: { create: true, edit: true, view: true, delete: true },
  template_export: { create: true, edit: true, view: true, delete: true },
  calibration_procedures: { create: true, edit: true, view: true, delete: true },
  work_instructions: { create: true, edit: true, view: true, delete: true },
  gauge_diagrams: { create: true, edit: true, view: true, delete: true },
  reports: { create: true, edit: true, view: true, delete: true },
  users: { create: true, edit: true, view: true, delete: true },
  settings: { create: true, edit: true, view: true, delete: true },
};

const QUALITY_MANAGER_PERMISSIONS: RolePermissions = {
  calibrations: { create: true, edit: true, view: true, delete: true },
  calibration_approvals: { create: true, edit: true, view: true, delete: false },
  calibration_schedule: { create: true, edit: true, view: true, delete: true },
  instruments: { create: true, edit: true, view: true, delete: true },
  templates: { create: true, edit: true, view: true, delete: true },
  template_builder: { create: true, edit: true, view: true, delete: false },
  template_import: { create: true, edit: true, view: true, delete: false },
  template_export: { create: true, edit: true, view: true, delete: false },
  calibration_procedures: { create: true, edit: true, view: true, delete: true },
  work_instructions: { create: true, edit: true, view: true, delete: true },
  gauge_diagrams: { create: true, edit: true, view: true, delete: true },
  reports: { create: true, edit: true, view: true, delete: false },
  users: { create: false, edit: false, view: true, delete: false },
  settings: { create: false, edit: false, view: true, delete: false },
};

const CALIBRATION_REVIEWER_PERMISSIONS: RolePermissions = {
  calibrations: { create: false, edit: true, view: true, delete: false },
  calibration_approvals: { create: false, edit: true, view: true, delete: false },
  calibration_schedule: { create: false, edit: false, view: true, delete: false },
  instruments: { create: false, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  template_builder: { create: false, edit: false, view: true, delete: false },
  template_import: { create: false, edit: false, view: false, delete: false },
  template_export: { create: false, edit: false, view: true, delete: false },
  calibration_procedures: { create: false, edit: false, view: true, delete: false },
  work_instructions: { create: false, edit: false, view: true, delete: false },
  gauge_diagrams: { create: false, edit: false, view: true, delete: false },
  reports: { create: true, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const CALIBRATION_APPROVER_PERMISSIONS: RolePermissions = {
  calibrations: { create: false, edit: true, view: true, delete: false },
  calibration_approvals: { create: true, edit: true, view: true, delete: false },
  calibration_schedule: { create: false, edit: false, view: true, delete: false },
  instruments: { create: false, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  template_builder: { create: false, edit: false, view: true, delete: false },
  template_import: { create: false, edit: false, view: false, delete: false },
  template_export: { create: false, edit: false, view: true, delete: false },
  calibration_procedures: { create: false, edit: false, view: true, delete: false },
  work_instructions: { create: false, edit: false, view: true, delete: false },
  gauge_diagrams: { create: false, edit: false, view: true, delete: false },
  reports: { create: true, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const CALIBRATION_ENGINEER_PERMISSIONS: RolePermissions = {
  calibrations: { create: true, edit: true, view: true, delete: false },
  calibration_approvals: { create: false, edit: false, view: true, delete: false },
  calibration_schedule: { create: true, edit: true, view: true, delete: false },
  instruments: { create: true, edit: true, view: true, delete: false },
  templates: { create: true, edit: true, view: true, delete: false },
  template_builder: { create: false, edit: false, view: true, delete: false },
  template_import: { create: false, edit: false, view: false, delete: false },
  template_export: { create: false, edit: false, view: true, delete: false },
  calibration_procedures: { create: true, edit: true, view: true, delete: false },
  work_instructions: { create: true, edit: true, view: true, delete: false },
  gauge_diagrams: { create: true, edit: true, view: true, delete: false },
  reports: { create: true, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const LAB_TECHNICIAN_PERMISSIONS: RolePermissions = {
  calibrations: { create: true, edit: true, view: true, delete: false },
  calibration_approvals: { create: false, edit: false, view: false, delete: false },
  calibration_schedule: { create: false, edit: false, view: true, delete: false },
  instruments: { create: true, edit: true, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  template_builder: { create: false, edit: false, view: false, delete: false },
  template_import: { create: false, edit: false, view: false, delete: false },
  template_export: { create: false, edit: false, view: false, delete: false },
  calibration_procedures: { create: false, edit: false, view: true, delete: false },
  work_instructions: { create: false, edit: false, view: true, delete: false },
  gauge_diagrams: { create: false, edit: false, view: true, delete: false },
  reports: { create: false, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const VIEWER_PERMISSIONS: RolePermissions = {
  calibrations: { create: false, edit: false, view: true, delete: false },
  calibration_approvals: { create: false, edit: false, view: false, delete: false },
  calibration_schedule: { create: false, edit: false, view: true, delete: false },
  instruments: { create: false, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  template_builder: { create: false, edit: false, view: false, delete: false },
  template_import: { create: false, edit: false, view: false, delete: false },
  template_export: { create: false, edit: false, view: false, delete: false },
  calibration_procedures: { create: false, edit: false, view: true, delete: false },
  work_instructions: { create: false, edit: false, view: true, delete: false },
  gauge_diagrams: { create: false, edit: false, view: true, delete: false },
  reports: { create: false, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultRoles();
    await this.repairAndSeedAllCompanies();
    await this.upgradeExistingRolesTo12Modules();
  }

  async upgradeExistingRolesTo12Modules() {
    try {
      const roles = await this.roleRepository.find();
      for (const role of roles) {
        const p = { ...(role.permissions || {}) };
        let modified = false;
        const roleNameLower = (role.name || '').toLowerCase();
        const isAdmin = roleNameLower.includes('admin');
        const isQualityManager = roleNameLower.includes('quality') || roleNameLower.includes('manager') || roleNameLower.includes('approver');
        const isReviewer = roleNameLower.includes('reviewer');
        const isEngineer = roleNameLower.includes('engineer');

        // 1. calibration_approvals
        if (!p.calibration_approvals) {
          if (isAdmin) {
            p.calibration_approvals = { create: true, edit: true, view: true, delete: true };
          } else if (isQualityManager) {
            p.calibration_approvals = { create: true, edit: true, view: true, delete: false };
          } else if (isReviewer) {
            p.calibration_approvals = { create: false, edit: true, view: true, delete: false };
          } else if (isEngineer) {
            p.calibration_approvals = { create: false, edit: false, view: true, delete: false };
          } else {
            p.calibration_approvals = { create: false, edit: false, view: false, delete: false };
          }
          modified = true;
        }

        // 2. calibration_schedule
        if (!p.calibration_schedule) {
          if (isAdmin || isQualityManager) {
            p.calibration_schedule = { create: true, edit: true, view: true, delete: isAdmin };
          } else if (isEngineer) {
            p.calibration_schedule = { create: true, edit: true, view: true, delete: false };
          } else {
            p.calibration_schedule = { create: false, edit: false, view: true, delete: false };
          }
          modified = true;
        }

        // 3. template_builder
        if (!p.template_builder) {
          if (isAdmin) {
            p.template_builder = { create: true, edit: true, view: true, delete: true };
          } else if (isQualityManager) {
            p.template_builder = { create: true, edit: true, view: true, delete: false };
          } else if (isEngineer) {
            p.template_builder = { create: false, edit: false, view: true, delete: false };
          } else {
            p.template_builder = { create: false, edit: false, view: false, delete: false };
          }
          modified = true;
        }

        // 4. template_import
        if (!p.template_import) {
          if (isAdmin) {
            p.template_import = { create: true, edit: true, view: true, delete: true };
          } else if (isQualityManager) {
            p.template_import = { create: true, edit: true, view: true, delete: false };
          } else {
            p.template_import = { create: false, edit: false, view: false, delete: false };
          }
          modified = true;
        }

        // 5. template_export
        if (!p.template_export) {
          if (isAdmin) {
            p.template_export = { create: true, edit: true, view: true, delete: true };
          } else if (isQualityManager || isEngineer || isReviewer) {
            p.template_export = { create: false, edit: false, view: true, delete: false };
          } else {
            p.template_export = { create: false, edit: false, view: false, delete: false };
          }
          modified = true;
        }

        // 6. calibration_procedures, work_instructions, gauge_diagrams
        const docModules = ['calibration_procedures', 'work_instructions', 'gauge_diagrams'];
        for (const mod of docModules) {
          if (!p[mod]) {
            if (isAdmin) {
              p[mod] = { create: true, edit: true, view: true, delete: true };
            } else if (isQualityManager) {
              p[mod] = { create: true, edit: true, view: true, delete: true };
            } else if (isEngineer || isReviewer) {
              p[mod] = { create: true, edit: true, view: true, delete: false };
            } else {
              p[mod] = { create: false, edit: false, view: true, delete: false };
            }
            modified = true;
          }
        }

        if (modified) {
          await this.roleRepository.update(role.id, { permissions: p });
        }
      }
    } catch (err) {
      console.error('Failed to upgrade roles to 12 modules:', err);
    }
  }

  private async repairAndSeedAllCompanies() {
    try {
      const companies = await this.companyRepository.find();
      for (const comp of companies) {
        const companyRoles = await this.seedCompanyRoles(comp.id);
        const adminRole = companyRoles.find((r) => r.name === 'Admin');

        if (adminRole) {
          // If registered user has no role, assign admin role
          if (comp.registeredUserId) {
            const regUser = await this.userRepository.findOne({ where: { id: comp.registeredUserId } });
            if (regUser && (!regUser.roleId || !regUser.role)) {
              await this.userRepository.update(comp.registeredUserId, {
                roleId: adminRole.id,
                companyId: comp.id,
              });
            }
          }

          // Also check all users belonging to this company with roleId null
          const usersWithoutRole = await this.userRepository.find({
            where: { companyId: comp.id, isSuperAdmin: false },
          });
          for (const u of usersWithoutRole) {
            if (!u.roleId) {
              await this.userRepository.update(u.id, { roleId: adminRole.id });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to repair/seed company roles:', err);
    }
  }

  private async seedDefaultRoles() {
    const defaultRoles = [
      {
        name: 'Admin',
        description: 'Full administrative access to all modules and user management',
        permissions: FULL_ACCESS_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Quality Manager',
        description: 'Full access to instruments & calibrations, view-only access to system users',
        permissions: QUALITY_MANAGER_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Calibration Reviewer',
        description: 'Reviews calibration data, readings, and formulas; approves review recommendation or rejects',
        permissions: CALIBRATION_REVIEWER_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Calibration Approver',
        description: 'Authorized signatory for final calibration approval, certificate release, and rejection',
        permissions: CALIBRATION_APPROVER_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Calibration Engineer',
        description: 'Performs calibration activities for assigned instruments and submits records for approval',
        permissions: CALIBRATION_ENGINEER_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Lab Technician',
        description: 'Can perform calibrations and update instruments, cannot delete master records',
        permissions: LAB_TECHNICIAN_PERMISSIONS,
        isSystemDefault: true,
      },
      {
        name: 'Viewer',
        description: 'Read-only access to instruments, calibrations, and reports',
        permissions: VIEWER_PERMISSIONS,
        isSystemDefault: true,
      },
    ];

    for (const roleData of defaultRoles) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleData.name, isSystemDefault: true },
      });
      if (!existing) {
        const role = this.roleRepository.create(roleData);
        await this.roleRepository.save(role);
      }
    }
  }

  async seedCompanyRoles(companyId: string): Promise<Role[]> {
    const existing = await this.roleRepository.find({ where: { companyId } });
    const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));

    const defaultRoles = [
      {
        name: 'Admin',
        description: 'Full administrative access to all modules and user management',
        permissions: FULL_ACCESS_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Quality Manager',
        description: 'Full access to instruments & calibrations, view-only access to system users',
        permissions: QUALITY_MANAGER_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Calibration Reviewer',
        description: 'Reviews calibration data, readings, and formulas; approves review recommendation or rejects',
        permissions: CALIBRATION_REVIEWER_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Calibration Approver',
        description: 'Authorized signatory for final calibration approval, certificate release, and rejection',
        permissions: CALIBRATION_APPROVER_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Calibration Engineer',
        description: 'Performs calibration activities for assigned instruments and submits records for approval',
        permissions: CALIBRATION_ENGINEER_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Lab Technician',
        description: 'Can perform calibrations and update instruments, cannot delete master records',
        permissions: LAB_TECHNICIAN_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
      {
        name: 'Viewer',
        description: 'Read-only access to instruments, calibrations, and reports',
        permissions: VIEWER_PERMISSIONS,
        companyId,
        isSystemDefault: false,
      },
    ];

    const results = [...existing];
    for (const rData of defaultRoles) {
      if (!existingNames.has(rData.name.toLowerCase())) {
        const r = this.roleRepository.create(rData);
        results.push(await this.roleRepository.save(r));
      }
    }
    return results;
  }

  async findAll(companyId?: string): Promise<Role[]> {
    if (companyId) {
      const existingCompanyRoles = await this.roleRepository.find({ where: { companyId } });
      if (existingCompanyRoles.length === 0) {
        await this.seedCompanyRoles(companyId);
      }

      const allRoles = await this.roleRepository.find({
        where: [{ companyId }, { isSystemDefault: true }],
        order: { name: 'ASC' },
      });

      // Map roles by lowercase name, prioritizing company-specific roles over system default templates
      const roleMap = new Map<string, Role>();
      
      // First populate default roles
      allRoles.filter(r => r.isSystemDefault).forEach(r => roleMap.set(r.name.toLowerCase(), r));
      
      // Override with company-specific roles
      allRoles.filter(r => r.companyId === companyId).forEach(r => roleMap.set(r.name.toLowerCase(), r));

      return Array.from(roleMap.values());
    }
    return this.roleRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async create(data: {
    name: string;
    description?: string;
    permissions: RolePermissions;
    companyId?: string;
  }): Promise<Role> {
    const role = this.roleRepository.create({
      ...data,
      isSystemDefault: false,
    });
    return this.roleRepository.save(role);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      permissions?: RolePermissions;
      companyId?: string;
    },
  ): Promise<Role> {
    const role = await this.findOne(id);

    // Copy-on-Write: If trying to edit a global system default role, fork a company-private role
    if (role.isSystemDefault && data.companyId) {
      let companyRole = await this.roleRepository.findOne({
        where: { companyId: data.companyId, name: role.name },
      });

      if (!companyRole) {
        companyRole = this.roleRepository.create({
          name: data.name || role.name,
          description: data.description !== undefined ? data.description : role.description,
          permissions: data.permissions || role.permissions,
          companyId: data.companyId,
          isSystemDefault: false,
        });
      } else {
        if (data.name) companyRole.name = data.name;
        if (data.description !== undefined) companyRole.description = data.description;
        if (data.permissions) companyRole.permissions = data.permissions;
      }

      const savedRole = await this.roleRepository.save(companyRole);

      // Update all users in this company assigned to the global default role to use the new company-scoped role ID
      await this.userRepository.update(
        { companyId: data.companyId, roleId: role.id },
        { roleId: savedRole.id },
      );

      return savedRole;
    }

    if (data.name) role.name = data.name;
    if (data.description !== undefined) role.description = data.description;
    if (data.permissions) role.permissions = data.permissions;
    if (data.companyId && !role.companyId) role.companyId = data.companyId;

    return this.roleRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.isSystemDefault) {
      throw new Error('System default roles cannot be deleted.');
    }
    await this.roleRepository.remove(role);
  }
}
