import { Test, TestingModule } from '@nestjs/testing';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('CalibrationTemplatesService', () => {
  let service: CalibrationTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationTemplatesService,
        {
          provide: getRepositoryToken(CalibrationTemplate),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<CalibrationTemplatesService>(CalibrationTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
