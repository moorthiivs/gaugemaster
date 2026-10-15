import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RecoveryService } from './recovery.service';
import { RecoveryQueryDto, BulkRestoreDto } from './dto/recovery-query.dto';

@Controller('api/recovery')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  /**
   * Helper to ensure the user has permission to view / restore records from the target module
   */
  private checkModuleAccess(req: any, targetModule?: string, action: 'view' | 'delete' = 'view') {
    const user = req.user;
    if (user?.isSuperAdmin) return;

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name || '';
    if (roleName.toLowerCase() === 'admin') return;

    const rolePermissions = user?.userRole?.permissions || (typeof user?.role === 'object' ? user?.role?.permissions : undefined);
    if (!rolePermissions) {
      throw new ForbiddenException('You do not have access to the Recovery Center.');
    }

    // RBAC: Check Recovery Center root permission
    if (rolePermissions.recovery !== undefined) {
      if (!rolePermissions.recovery.view) {
        throw new ForbiddenException('You do not have access to the Recovery Center.');
      }
      if (action === 'delete' && !rolePermissions.recovery.delete && !rolePermissions.recovery.edit) {
        throw new ForbiddenException('You do not have permission to restore records from the Recovery Center.');
      }
    }

    if (targetModule && targetModule !== 'all') {
      const moduleKey = targetModule === 'templates' ? 'templates' : targetModule;
      const perm = rolePermissions[moduleKey];
      if (!perm || !perm[action]) {
        throw new ForbiddenException(`You do not have permission to ${action} ${targetModule} in the Recovery Center.`);
      }
    }
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    this.checkModuleAccess(req);
    const companyId = req.user?.companyId;
    return this.recoveryService.getStats(companyId);
  }

  @Get()
  async getDeletedItems(@Req() req: any, @Query() query: RecoveryQueryDto) {
    this.checkModuleAccess(req, query.module, 'view');
    const companyId = req.user?.companyId;
    return this.recoveryService.getDeletedItems(companyId, query);
  }

  @Get(':module/:id')
  async getDeletedItemDetail(
    @Req() req: any,
    @Param('module') module: string,
    @Param('id') id: string,
  ) {
    this.checkModuleAccess(req, module, 'view');
    const companyId = req.user?.companyId;
    return this.recoveryService.getDeletedItemDetail(module, id, companyId);
  }

  @Post(':module/:id/restore')
  async restoreRecord(
    @Req() req: any,
    @Param('module') module: string,
    @Param('id') id: string,
  ) {
    this.checkModuleAccess(req, module, 'delete');
    return this.recoveryService.restoreRecord(module, id, req.user);
  }

  @Post('bulk-restore')
  async bulkRestore(@Req() req: any, @Body() dto: BulkRestoreDto) {
    this.checkModuleAccess(req);
    return this.recoveryService.bulkRestore(dto.items || [], req.user);
  }
}
