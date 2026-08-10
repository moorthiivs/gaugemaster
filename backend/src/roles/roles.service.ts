import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RolePermissions } from './role.entity';
import { User } from '../users/user.entity';

export const DEFAULT_MODULES = [
  'instruments',
  'calibrations',
  'reports',
  'templates',
  'users',
  'settings',
];

const FULL_ACCESS_PERMISSIONS: RolePermissions = {
  instruments: { create: true, edit: true, view: true, delete: true },
  calibrations: { create: true, edit: true, view: true, delete: true },
  reports: { create: true, edit: true, view: true, delete: true },
  templates: { create: true, edit: true, view: true, delete: true },
  users: { create: true, edit: true, view: true, delete: true },
  settings: { create: true, edit: true, view: true, delete: true },
};

const QUALITY_MANAGER_PERMISSIONS: RolePermissions = {
  instruments: { create: true, edit: true, view: true, delete: true },
  calibrations: { create: true, edit: true, view: true, delete: true },
  reports: { create: true, edit: true, view: true, delete: false },
  templates: { create: true, edit: true, view: true, delete: false },
  users: { create: false, edit: false, view: true, delete: false },
  settings: { create: false, edit: false, view: true, delete: false },
};

const LAB_TECHNICIAN_PERMISSIONS: RolePermissions = {
  instruments: { create: true, edit: true, view: true, delete: false },
  calibrations: { create: true, edit: true, view: true, delete: false },
  reports: { create: true, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const CALIBRATION_ENGINEER_PERMISSIONS: RolePermissions = {
  instruments: { create: true, edit: true, view: true, delete: false },
  calibrations: { create: true, edit: true, view: true, delete: false },
  reports: { create: true, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
  users: { create: false, edit: false, view: false, delete: false },
  settings: { create: false, edit: false, view: false, delete: false },
};

const VIEWER_PERMISSIONS: RolePermissions = {
  instruments: { create: false, edit: false, view: true, delete: false },
  calibrations: { create: false, edit: false, view: true, delete: false },
  reports: { create: false, edit: false, view: true, delete: false },
  templates: { create: false, edit: false, view: true, delete: false },
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
  ) {}

  async onModuleInit() {
    await this.seedDefaultRoles();
  }

  private async seedDefaultRoles() {
    const count = await this.roleRepository.count();
    if (count === 0) {
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
        const role = this.roleRepository.create(roleData);
        await this.roleRepository.save(role);
      }
    }
  }

  async seedCompanyRoles(companyId: string): Promise<Role[]> {
    const existing = await this.roleRepository.find({ where: { companyId } });
    if (existing.length > 0) return existing;

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

    const created: Role[] = [];
    for (const rData of defaultRoles) {
      const r = this.roleRepository.create(rData);
      created.push(await this.roleRepository.save(r));
    }
    return created;
  }

  async findAll(companyId?: string): Promise<Role[]> {
    if (companyId) {
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
