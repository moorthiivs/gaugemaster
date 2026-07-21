import { Module } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';
import { InstrumentsController } from './instruments.controller';
import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from 'src/mail/mailer.module';
import { ValidationModule } from 'src/validation/validation.module';

import { BackupModule } from 'src/backup/backup.module';

@Module({
  imports: [TypeOrmModule.forFeature([Instrument, CalibrationHistory]), MailerModule, ValidationModule, BackupModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService],
  exports: [InstrumentsService],
})
export class InstrumentsModule { }