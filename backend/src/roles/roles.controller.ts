import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolePermissions } from './role.entity';

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
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      permissions?: RolePermissions;
    },
  ) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
