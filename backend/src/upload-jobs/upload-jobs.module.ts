import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadJob } from './upload-job.entity';
import { UploadJobsService } from './upload-jobs.service';
import { UploadJobsController } from './upload-jobs.controller';
import { InstrumentsModule } from '../instruments/instruments.module';

@Module({
  imports: [TypeOrmModule.forFeature([UploadJob]), InstrumentsModule],
  controllers: [UploadJobsController],
  providers: [UploadJobsService],
  exports: [UploadJobsService],
})
export class UploadJobsModule {}
