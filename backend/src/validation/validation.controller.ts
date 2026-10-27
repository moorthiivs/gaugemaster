import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ValidationService } from './validation.service';
import { ValidationRule } from './validation-rule.entity';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/validation')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('rules')
  async getRules(@Query('companyId') queryCompanyId: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    if (!companyId) throw new ForbiddenException('Company context required');
    return await this.validationService.getRules(companyId);
  }

  @Post('rules')
  @RequirePermission('settings', 'edit')
  async updateRules(
    @Query('companyId') queryCompanyId: string,
    @Body() rules: Partial<ValidationRule>[],
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    if (!companyId) throw new ForbiddenException('Company context required');
    return await this.validationService.updateRules(companyId, rules);
  }

  @Post('custom-field')
  @RequirePermission('settings', 'edit')
  async addCustomField(
    @Query('companyId') queryCompanyId: string,
    @Body() body: {
      fieldName: string;
      displayName: string;
      validationType?: string;
      isRequired?: boolean;
      excelAliases?: string[];
    },
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    if (!companyId) throw new ForbiddenException('Company context required');
    return await this.validationService.addCustomField(companyId, body);
  }

  @Delete('custom-field/:id')
  @RequirePermission('settings', 'edit')
  async deleteCustomField(@Param('id') id: string) {
    return await this.validationService.deleteCustomField(id);
  }
}
