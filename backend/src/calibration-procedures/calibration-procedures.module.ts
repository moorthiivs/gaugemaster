import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalibrationProcedure } from './calibration-procedure.entity';
import { CalibrationProcedureHistory } from './calibration-procedure-history.entity';
import { CalibrationProceduresService } from './calibration-procedures.service';
import { CalibrationProceduresController } from './calibration-procedures.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalibrationProcedure, CalibrationProcedureHistory]),
  ],
  controllers: [CalibrationProceduresController],
  providers: [CalibrationProceduresService],
  exports: [CalibrationProceduresService],
})
export class CalibrationProceduresModule {}
