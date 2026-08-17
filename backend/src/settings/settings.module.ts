import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { LocationEmail } from './entities/location-email.entity';
import { MailerModule } from '../mail/mailer.module';
import { User } from '../users/user.entity';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, User, LocationEmail]), MailerModule],
  controllers: [SettingsController],
  providers: [SettingsService, PermissionsGuard],
  exports: [SettingsService, TypeOrmModule]
})
export class SettingsModule { }
