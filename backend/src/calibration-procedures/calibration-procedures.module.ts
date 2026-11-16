import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalibrationProcedure } from './calibration-procedure.entity';
import { CalibrationProcedureHistory } from './calibration-procedure-history.entity';
import { CalibrationProceduresService } from './calibration-procedures.service';
import { CalibrationProceduresController } from './calibration-procedures.controller';
import { User } from '../users/user.entity';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalibrationProcedure, CalibrationProcedureHistory, User]),
  ],
  controllers: [CalibrationProceduresController],
  providers: [CalibrationProceduresService, PermissionsGuard],
  exports: [CalibrationProceduresService],
})
export class CalibrationProceduresModule {}
