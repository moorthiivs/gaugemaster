import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelPrintHistory } from './label-print-history.entity';
import { LabelPrintHistoryService } from './label-print-history.service';
import { LabelPrintHistoryController } from './label-print-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LabelPrintHistory])],
  providers: [LabelPrintHistoryService],
  controllers: [LabelPrintHistoryController],
  exports: [LabelPrintHistoryService],
})
export class LabelPrintHistoryModule {}
