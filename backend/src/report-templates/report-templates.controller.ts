import { Controller, Get, Post, Patch, Delete, Body, Query, Param } from '@nestjs/common';
import { ReportTemplatesService } from './report-templates.service';

@Controller('api/report-templates')
export class ReportTemplatesController {
  constructor(private readonly service: ReportTemplatesService) {}

  @Post()
  async create(
    @Body() dto: { name: string; headerText?: string; footerText?: string; userId: string; companyId?: string }
  ) {
    return this.service.create(dto);
  }

  @Get()
  async findAll(@Query('userId') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; headerText?: string; footerText?: string }
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
