import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('api/settings')
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) { }

  @Post("mailconfig")
  create(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get('fetchmailconfig')
  findOne(
    @Query('userId') userId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.settingsService.findOne(userId, companyId);
  }



}
