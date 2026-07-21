import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
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

}
