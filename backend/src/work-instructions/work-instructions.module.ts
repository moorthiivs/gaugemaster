import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkInstruction } from './work-instruction.entity';
import { WorkInstructionHistory } from './work-instruction-history.entity';
import { WorkInstructionsService } from './work-instructions.service';
import { WorkInstructionsController } from './work-instructions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkInstruction, WorkInstructionHistory]),
  ],
  controllers: [WorkInstructionsController],
  providers: [WorkInstructionsService],
  exports: [WorkInstructionsService],
})
export class WorkInstructionsModule {}
