import {
  Controller,
  Get,
  Post,
  Delete,
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
import { RecoveryQueryDto, BulkRestoreDto, BulkPermanentDeleteDto } from './dto/recovery-query.dto';

@Controller('api/recovery')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  /**
   * Helper to ensure the user has permission to view, restore, or permanently delete records
   */
  private checkModuleAccess(
    req: any,
    targetModule?: string,
    action: 'view' | 'restore' | 'delete' = 'view',
  ) {
    const user = req.user;
    if (user?.isSuperAdmin) return;

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name || '';
    if (roleName.toLowerCase() === 'admin') return;

    const rolePermissions =
      user?.userRole?.permissions ||
      (typeof user?.role === 'object' ? user?.role?.permissions : undefined);
    if (!rolePermissions) {
      throw new ForbiddenException('You do not have access to the Recovery Center.');
    }

    // RBAC: Check Recovery Center root permission
    if (rolePermissions.recovery !== undefined) {
      if (!rolePermissions.recovery.view) {
        throw new ForbiddenException('You do not have access to the Recovery Center.');
      }
      if (action === 'restore' && !rolePermissions.recovery.delete && !rolePermissions.recovery.edit) {
        throw new ForbiddenException('You do not have permission to restore records from the Recovery Center.');
      }
      if (action === 'delete' && !rolePermissions.recovery.delete) {
        throw new ForbiddenException('You do not have permission to permanently delete records from the Recovery Center.');
      }
    }

    if (targetModule && targetModule !== 'all') {
      const moduleKey = targetModule === 'templates' ? 'templates' : targetModule;
      const perm = rolePermissions[moduleKey];
      if (!perm) {
        throw new ForbiddenException(`You do not have permission to access ${targetModule}.`);
      }
      if (action === 'view' && !perm.view) {
        throw new ForbiddenException(`You do not have permission to view ${targetModule} in the Recovery Center.`);
      }
      if (action === 'restore' && !perm.edit && !perm.create && !perm.delete) {
        throw new ForbiddenException(`You do not have permission to restore ${targetModule} in the Recovery Center.`);
      }
      if (action === 'delete' && !perm.delete) {
        throw new ForbiddenException(`You do not have permission to permanently delete ${targetModule} records.`);
      }
    }
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    this.checkModuleAccess(req);
    const companyId = req.user?.companyId;
    return this.recoveryService.getStats(companyId);
  }

  @Get('ids')
  async getDeletedItemIds(@Req() req: any, @Query() query: RecoveryQueryDto) {
    this.checkModuleAccess(req, query.module, 'view');
    const companyId = req.user?.companyId;
    return this.recoveryService.getDeletedItemIds(companyId, query);
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
    @Query('reassignOnConflict') reassignOnConflict?: string,
    @Body('reassignOnConflict') bodyReassignOnConflict?: boolean,
  ) {
    this.checkModuleAccess(req, module, 'restore');
    const shouldReassign =
      reassignOnConflict === 'true' || reassignOnConflict === '1' || bodyReassignOnConflict === true;
    return this.recoveryService.restoreRecord(module, id, req.user, shouldReassign);
  }

  @Post('bulk-restore')
  async bulkRestore(@Req() req: any, @Body() dto: BulkRestoreDto) {
    this.checkModuleAccess(req, undefined, 'restore');
    return this.recoveryService.bulkRestore(dto.items || [], req.user);
  }

  @Delete(':module/:id/permanent')
  async permanentDelete(
    @Req() req: any,
    @Param('module') module: string,
    @Param('id') id: string,
  ) {
    this.checkModuleAccess(req, module, 'delete');
    return this.recoveryService.permanentDelete(module, id, req.user);
  }

  @Post('bulk-permanent-delete')
  async bulkPermanentDelete(@Req() req: any, @Body() dto: BulkPermanentDeleteDto) {
    this.checkModuleAccess(req, undefined, 'delete');
    return this.recoveryService.bulkPermanentDelete(dto.items || [], req.user);
  }
}

