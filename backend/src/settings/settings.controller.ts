import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers, UseInterceptors, UploadedFile, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    const userId = user.isSuperAdmin ? (queryUserId || user.userId || user.id) : (user.userId || user.id);

    return this.settingsService.getThemeSettings(userId, companyId);
  }

  @Post('theme')
  saveTheme(
    @Body() body: any,
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (body.companyId || user.companyId) : user.companyId;
    const userId = user.isSuperAdmin ? (body.userId || user.userId || user.id) : (user.userId || user.id);
    const themeSettings = body.themeSettings || body;

    return this.settingsService.saveThemeSettings(userId, companyId, themeSettings, user);
  }

  @Get(':userId/:companyId')
  @RequirePermission('settings', 'view')
  getSettings(
    @Param('userId') userId: string,
    @Param('companyId') companyId: string,
    @Req() req: any,
  ) {
    const user = req.user || {};
    if (!user.isSuperAdmin && user.companyId && companyId && user.companyId !== companyId) {
      throw new ForbiddenException('Access denied to other company settings');
    }
    return this.settingsService.findOne(userId, companyId);
  }

  @Post("mailconfig")
  @RequirePermission('settings', 'edit')
  create(@Body() createSettingDto: CreateSettingDto, @Req() req: any) {
    const user = req.user || {};
    createSettingDto.companyId = user.isSuperAdmin ? (createSettingDto.companyId || user.companyId) : user.companyId;
    createSettingDto.userId = user.isSuperAdmin ? (createSettingDto.userId || user.userId || user.id) : (user.userId || user.id);
    return this.settingsService.create(createSettingDto);
  }

  @Get('fetchmailconfig')
  fetchMailConfig(
    @Query('userId') queryUserId: string,
    @Query('companyId') queryCompanyId: string,
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    const userId = user.isSuperAdmin ? (queryUserId || user.userId || user.id) : (user.userId || user.id);
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

