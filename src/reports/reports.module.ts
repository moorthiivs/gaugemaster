import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Instrument])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule { }