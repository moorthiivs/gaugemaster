import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { CreateCalibrationTemplateDto } from './dto/create-calibration-template.dto';
import { UpdateCalibrationTemplateDto } from './dto/update-calibration-template.dto';

@Controller('api/calibration-templates')
export class CalibrationTemplatesController {
  constructor(
    private readonly templatesService: CalibrationTemplatesService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCalibrationTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('calibrationType') calibrationType?: string,
  ) {
    return this.templatesService.findAll({ userId, companyId, calibrationType });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCalibrationTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.templatesService.remove(id);
    return { message: 'Template deleted successfully' };
  }
}
