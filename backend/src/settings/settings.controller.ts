import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiTags } from '@nestjs/swagger';
import { MailerService } from '../mail/mailer.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@ApiTags('api/settings')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailerService: MailerService
  ) { }

  @Get()
  @RequirePermission('settings', 'view')
  getSettingsByQuery(
    @Query('userId') userId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!userId) return null;
    if (companyId) {
      return this.settingsService.findOne(userId, companyId);
    }
    return this.settingsService.findOneByUserId(userId);
  }

  @Post()
  @RequirePermission('settings', 'edit')
  saveSettings(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get('theme')
  getTheme(
    @Query('userId') queryUserId: string,
    @Query('companyId') queryCompanyId: string,
    @Headers('authorization') authHeader: string,
    @Req() req: any,
  ) {
    let tokenUserId: string | undefined;
    let tokenCompanyId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        tokenUserId = payload.sub;
        tokenCompanyId = payload.companyId;
      } catch (e) {
        // ignore
      }
    }

    const userId = queryUserId || req.user?.userId || req.user?.id || tokenUserId;
    const companyId = queryCompanyId || req.user?.companyId || tokenCompanyId;

    return this.settingsService.getThemeSettings(userId, companyId);
  }

  @Post('theme')
  saveTheme(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
    @Req() req: any,
  ) {
    let tokenUserId: string | undefined;
    let tokenCompanyId: string | undefined;
    let tokenPayload: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        tokenUserId = tokenPayload.sub;
        tokenCompanyId = tokenPayload.companyId;
      } catch (e) {
        // ignore
      }
    }

    const userId = body.userId || req.user?.userId || req.user?.id || tokenUserId;
    const companyId = body.companyId || req.user?.companyId || tokenCompanyId;
    const themeSettings = body.themeSettings || body;

    return this.settingsService.saveThemeSettings(userId, companyId, themeSettings, req.user || tokenPayload);
  }

  @Get(':userId/:companyId')
  @RequirePermission('settings', 'view')
  getSettings(
    @Param('userId') userId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.settingsService.findOne(userId, companyId);
  }

  @Post("mailconfig")
  @RequirePermission('settings', 'edit')
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
    //console.log("RECEIVED SETTINGS PAYLOAD: ", createSettingDto);
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
  @RequirePermission('settings', 'edit')
  sendTestEmail(
    @Body('userId') userId: string,
    @Body('targetEmail') targetEmail: string,
    @Body('smtpConfig') smtpConfig?: any,
  ) {
    return this.mailerService.sendTestMail(userId, targetEmail, smtpConfig);
  }

  @Post('upload-logo')
  @RequirePermission('settings', 'edit')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/logos',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }))
  async uploadLogo(@UploadedFile() file: any) {
    const logoUrl = `/uploads/logos/${file.filename}`;
    return { message: 'Logo uploaded successfully', url: logoUrl };
  }

  @Get('location-emails')
  async getLocationEmails(@Query('companyId') companyId: string) {
    return this.settingsService.getLocationEmails(companyId);
  }

  @Post('location-emails')
  @RequirePermission('settings', 'edit')
  async saveLocationEmail(@Body() body: any) {
    return this.settingsService.upsertLocationEmail(body);
  }

  @Delete('location-emails/:id')
  @RequirePermission('settings', 'edit')
  async deleteLocationEmail(@Param('id') id: string) {
    return this.settingsService.deleteLocationEmail(id);
  }

  @Get('instrument-statuses')
  async getInstrumentStatuses(
    @Query('companyId') companyId: string,
    @Req() req: any,
  ) {
    const effectiveCompanyId = companyId || req?.user?.companyId;
    return this.settingsService.getCustomInstrumentStatuses(effectiveCompanyId);
  }

  @Post('instrument-statuses')
  async addInstrumentStatus(
    @Body('companyId') bodyCompanyId: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    const effectiveCompanyId = bodyCompanyId || req?.user?.companyId;
    return this.settingsService.addCustomInstrumentStatus(effectiveCompanyId, status);
  }
}

