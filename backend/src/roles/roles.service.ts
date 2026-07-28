import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RolePermissions } from './role.entity';

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

  async findAll(companyId?: string): Promise<Role[]> {
    if (companyId) {
      return this.roleRepository.find({
        where: [{ companyId }, { isSystemDefault: true }],
        order: { name: 'ASC' },
      });
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
    },
  ): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, data);
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
