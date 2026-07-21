import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Instrument, CalibrationHistory])], 
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
