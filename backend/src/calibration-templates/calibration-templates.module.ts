import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { CalibrationTemplatesController } from './calibration-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CalibrationTemplate])],
  controllers: [CalibrationTemplatesController],
  providers: [CalibrationTemplatesService],
  exports: [CalibrationTemplatesService],
})
export class CalibrationTemplatesModule {}
