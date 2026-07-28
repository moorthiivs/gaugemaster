import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Instrument, CalibrationHistory, User])], 
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
