import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiTags } from '@nestjs/swagger';
import { MailerService } from '../mail/mailer.service';

@ApiTags('api/settings')
@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailerService: MailerService
  ) { }

  @Post()
  saveSettings(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get(':userId/:companyId')
  getSettings(
    @Param('userId') userId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.settingsService.findOne(userId, companyId);
  }

  @Post("mailconfig")
  create(@Body() createSettingDto: CreateSettingDto, @Headers('authorization') authHeader: string) {
    if (!createSettingDto.userId || createSettingDto.userId === 'undefined') {
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                createSettingDto.userId = payload.sub;
                createSettingDto.companyId = createSettingDto.companyId || payload.companyId;
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }
    }
    console.log("RECEIVED SETTINGS PAYLOAD: ", createSettingDto);
    return this.settingsService.create(createSettingDto);
  }

  @Get('fetchmailconfig')
  fetchMailConfig(
    @Query('userId') userId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.settingsService.findOne(userId, companyId);
  }

  @Post('test-email')
  sendTestEmail(
    @Body('userId') userId: string,
    @Body('targetEmail') targetEmail: string,
  ) {
    return this.mailerService.sendTestMail(userId, targetEmail);
  }

}
