// src/mail/mailer.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './mailer.service';
import { Setting } from 'src/settings/entities/setting.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Setting])],
    providers: [MailerService],
    exports: [MailerService], 
})
export class MailerModule { }
