import { Test, TestingModule } from '@nestjs/testing';
import { UploadJobsService } from './upload-jobs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UploadJob } from './upload-job.entity';
import { InstrumentsService } from '../instruments/instruments.service';
import { DataSource } from 'typeorm';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('UploadJobsService', () => {
  let service: UploadJobsService;
  let mockJobRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    mockJobRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadJobsService,
        { provide: getRepositoryToken(UploadJob), useValue: mockJobRepo },
        {
          provide: InstrumentsService,
          useValue: {
            bulkUpload: jest.fn().mockResolvedValue({ successCount: 1, failedCount: 0, rejected: [] }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<UploadJobsService>(UploadJobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reconcile interrupted zombie jobs on module init', async () => {
    mockJobRepo.update.mockResolvedValue({ affected: 2 });

    await service.onModuleInit();

    expect(mockJobRepo.update).toHaveBeenCalledWith(
      { status: 'processing' },
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
