import { Controller, Get, Post, Patch, Delete, Body, Query, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReportTemplatesService } from './report-templates.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/report-templates')
export class ReportTemplatesController {
  constructor(private readonly service: ReportTemplatesService) {}

  @Post()
  @RequirePermission('reports', 'create')
  async create(
    @Body() dto: { name: string; headerText?: string; footerText?: string; userId?: string; companyId?: string },
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (dto.companyId || user.companyId) : user.companyId;
    const userId = user.isSuperAdmin ? (dto.userId || user.userId || user.id) : (user.userId || user.id);
    return this.service.create({
      ...dto,
      companyId,
      userId,
    });
  }

  @Get()
  @RequirePermission('reports', 'view')
  async findAll(
    @Query('userId') queryUserId?: string,
    @Query('companyId') queryCompanyId?: string,
    @Req() req?: any,
  ) {
    const user = req?.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    const userId = user.isSuperAdmin ? (queryUserId || user.userId || user.id) : (user.userId || user.id);
    return this.service.findAll(userId, companyId);
  }

  @Get(':id')
  @RequirePermission('reports', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('reports', 'edit')
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; headerText?: string; footerText?: string }
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('reports', 'delete')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
