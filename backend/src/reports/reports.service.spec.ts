import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Instrument } from '../instruments/instrument.entity';
import { User } from '../users/user.entity';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Instrument),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn(),
          },
        },
        {
          provide: ReportTemplatesService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
