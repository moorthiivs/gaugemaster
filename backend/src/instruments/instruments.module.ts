import { Module } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';
import { InstrumentsController } from './instruments.controller';
import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from 'src/mail/mailer.module';
import { ValidationModule } from 'src/validation/validation.module';

import { User } from 'src/users/user.entity';
import { BackupModule } from 'src/backup/backup.module';
import { PermissionsGuard } from 'src/auth/permissions.guard';
import { ReminderModule } from 'src/reminder/reminder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instrument, CalibrationHistory, User]),
    MailerModule,
    ValidationModule,
    BackupModule,
    ReminderModule,
  ],
  controllers: [InstrumentsController],
  providers: [InstrumentsService, PermissionsGuard],
  exports: [InstrumentsService],
})
export class InstrumentsModule { }