import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { MailerModule } from '../mail/mailer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), MailerModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule { }
