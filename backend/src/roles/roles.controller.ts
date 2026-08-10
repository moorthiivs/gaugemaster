import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { RolePermissions } from './role.entity';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller(['api/roles', 'roles'])
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async findAll(@Query('companyId') companyId?: string) {
    return this.rolesService.findAll(companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermission('users', 'create')
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      permissions: RolePermissions;
      companyId?: string;
    },
  ) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @RequirePermission('users', 'edit')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      permissions?: RolePermissions;
      companyId?: string;
    },
  ) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
