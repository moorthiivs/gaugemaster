import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
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
  @RequirePermission('settings', 'edit')
  sendTestEmail(
    @Body('userId') userId: string,
    @Body('targetEmail') targetEmail: string,
  ) {
    return this.mailerService.sendTestMail(userId, targetEmail);
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

}
