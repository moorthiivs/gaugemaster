import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('api/company')
@Controller('api/company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) { }

  @Post('register')
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companyService.create(createCompanyDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('settings', 'view')
  findAll() {
    return this.companyService.findAll();
  }
}
