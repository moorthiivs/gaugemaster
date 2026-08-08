import { Controller, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SuperAdminService } from './super-admin.service';
import { UpdateCompanyAccessDto, UpdateCompanyDto, DeleteCompanyDto } from './dto/super-admin.dto';

@ApiTags('api/super-admin')
@ApiBearerAuth()
@Controller('api/super-admin')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('companies')
  listCompanies() {
    return this.superAdminService.listCompanies();
  }

  @Get('companies/:id')
  getCompanyDetails(@Param('id') id: string) {
    return this.superAdminService.getCompanyDetails(id);
  }

  @Patch('companies/:id')
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.superAdminService.updateCompany(id, dto);
  }

  @Patch('companies/:id/access')
  updateAccess(@Param('id') id: string, @Body() dto: UpdateCompanyAccessDto) {
    return this.superAdminService.updateAccess(id, dto);
  }

  @Get('companies/:id/stats')
  getCompanyStats(@Param('id') id: string) {
    return this.superAdminService.getCompanyStats(id);
  }

  @Delete('companies/:id')
  deleteCompany(@Param('id') id: string, @Body() dto: DeleteCompanyDto) {
    return this.superAdminService.deleteCompany(id, dto.confirmationName);
  }
}
