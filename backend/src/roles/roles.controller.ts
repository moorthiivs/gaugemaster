import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
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
  async findAll(@Query('companyId') queryCompanyId?: string, @Req() req?: any) {
    const user = req?.user || {};
    const effectiveCompanyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    return this.rolesService.findAll(effectiveCompanyId);
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
    @Req() req: any,
  ) {
    const user = req.user || {};
    const effectiveCompanyId = user.isSuperAdmin ? (body.companyId || user.companyId) : user.companyId;
    return this.rolesService.create({
      ...body,
      companyId: effectiveCompanyId,
    });
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
    @Req() req: any,
  ) {
    const existing = await this.rolesService.findOne(id);
    const user = req.user || {};
    if (!user.isSuperAdmin && existing.companyId && user.companyId && existing.companyId !== user.companyId) {
      throw new ForbiddenException('Cannot modify role outside your company');
    }
    const effectiveCompanyId = user.isSuperAdmin ? (body.companyId || existing.companyId) : user.companyId;
    return this.rolesService.update(id, {
      ...body,
      companyId: effectiveCompanyId,
    });
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    const existing = await this.rolesService.findOne(id);
    const user = req.user || {};
    if (!user.isSuperAdmin && existing.companyId && user.companyId && existing.companyId !== user.companyId) {
      throw new ForbiddenException('Cannot delete role outside your company');
    }
    return this.rolesService.remove(id);
  }
}
