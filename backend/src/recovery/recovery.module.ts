import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Calibration } from '../calibration/calibration.entity';
import { Instrument } from '../instruments/instrument.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { CalibrationProcedure } from '../calibration-procedures/calibration-procedure.entity';
import { WorkInstruction } from '../work-instructions/work-instruction.entity';
import { GaugeDiagram } from '../gauge-diagrams/gauge-diagram.entity';
import { User } from '../users/user.entity';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Calibration,
      Instrument,
      CalibrationTemplate,
      CalibrationProcedure,
      WorkInstruction,
      GaugeDiagram,
      User,
    ]),
    AuditLogsModule,
    InstrumentsModule,
  ],
  controllers: [RecoveryController],
  providers: [RecoveryService],
  exports: [RecoveryService],
})
export class RecoveryModule {}
