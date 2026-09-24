import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { LocationEmail } from './entities/location-email.entity';
import { CopilotConversation } from './entities/copilot-conversation.entity';
import { CopilotMessage } from './entities/copilot-message.entity';
import { CopilotDailyQuota } from './entities/copilot-daily-quota.entity';
import { MailerModule } from '../mail/mailer.module';
import { User } from '../users/user.entity';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Setting,
      User,
      LocationEmail,
      CopilotConversation,
      CopilotMessage,
      CopilotDailyQuota,
    ]),
    MailerModule,
  ],
  controllers: [SettingsController, AiController],
  providers: [SettingsService, PermissionsGuard, AiService],
  exports: [SettingsService, AiService, TypeOrmModule]
})
export class SettingsModule { }
