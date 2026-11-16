import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Instrument } from '../instruments/instrument.entity';
import { CalibrationHistory } from '../instruments/calibration-history.entity';
import { User } from '../users/user.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Instrument),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CalibrationHistory),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
