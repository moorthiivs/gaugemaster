import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LabelPrintHistoryService } from './label-print-history.service';
import { CreateLabelPrintHistoryDto } from './dto/create-label-print-history.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('api/label-print-history')
export class LabelPrintHistoryController {
  constructor(
    private readonly labelPrintHistoryService: LabelPrintHistoryService,
  ) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() dto: CreateLabelPrintHistoryDto,
    @Query('companyId') queryCompanyId?: string,
    @Query('userId') queryUserId?: string,
  ) {
    const user = req.user || {};
    const companyId = queryCompanyId || user.companyId || (user.company && user.company.id);
    const userId = queryUserId || user.id || user.sub;

    return await this.labelPrintHistoryService.create(userId, companyId, dto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    const user = req.user || {};
    const companyId = queryCompanyId || user.companyId || (user.company && user.company.id);

    return await this.labelPrintHistoryService.findAll(companyId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      action,
      search,
    });
  }

  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id') id: string,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user || {};
    const companyId = queryCompanyId || user.companyId || (user.company && user.company.id);

    return await this.labelPrintHistoryService.findOne(companyId, id);
  }

  @Delete(':id')
  async delete(
    @Req() req: any,
    @Param('id') id: string,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user || {};
    const companyId = queryCompanyId || user.companyId || (user.company && user.company.id);

    return await this.labelPrintHistoryService.delete(companyId, id);
  }
}
