import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportTemplate } from './entities/report-template.entity';
import { ReportTemplatesService } from './report-templates.service';
import { ReportTemplatesController } from './report-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportTemplate])],
  controllers: [ReportTemplatesController],
  providers: [ReportTemplatesService],
  exports: [ReportTemplatesService, TypeOrmModule],
})
export class ReportTemplatesModule {}
