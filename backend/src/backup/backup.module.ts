import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { GoogleDriveService } from './google-drive.service';
import { BackupRecord } from './backup-record.entity';
import { BackupSchedule } from './backup-schedule.entity';
import { DriveToken } from './drive-token.entity';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([BackupRecord, BackupSchedule, DriveToken]),
    ],
    controllers: [BackupController],
    providers: [BackupService, GoogleDriveService],
    exports: [BackupService, GoogleDriveService],
})
export class BackupModule { }
