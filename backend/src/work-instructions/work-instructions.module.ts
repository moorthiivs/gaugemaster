import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkInstruction } from './work-instruction.entity';
import { WorkInstructionHistory } from './work-instruction-history.entity';
import { WorkInstructionsService } from './work-instructions.service';
import { WorkInstructionsController } from './work-instructions.controller';
import { User } from '../users/user.entity';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkInstruction, WorkInstructionHistory, User]),
  ],
  controllers: [WorkInstructionsController],
  providers: [WorkInstructionsService, PermissionsGuard],
  exports: [WorkInstructionsService],
})
export class WorkInstructionsModule {}
