import { Test, TestingModule } from '@nestjs/testing';
import { CalibrationService } from './calibration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CalibrationAuditLog } from './calibration-audit-log.entity';
import { User } from '../users/user.entity';
import { SettingsService } from '../settings/settings.service';
import { InstrumentsService } from '../instruments/instruments.service';
import { DataSource } from 'typeorm';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('CalibrationService', () => {
  let service: CalibrationService;
  let mockCalibrationRepo: ReturnType<typeof createMockRepository>;
  let mockDataSource: any;

  beforeEach(async () => {
    mockCalibrationRepo = createMockRepository();
    mockDataSource = {
      transaction: jest.fn(async (cb) => {
        const mockManager = {
          create: jest.fn((entity, data) => ({ ...data })),
          save: jest.fn((entity, data) => Promise.resolve({ id: 'cal-uuid-123', ...data })),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return await cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationService,
        { provide: getRepositoryToken(Calibration), useValue: mockCalibrationRepo },
        { provide: getRepositoryToken(CalibrationDraft), useValue: createMockRepository() },
        { provide: getRepositoryToken(CalibrationAuditLog), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        {
          provide: SettingsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              certificateConfig: {
                certPrefix: 'CERT',
                certSeparator: '/',
                certYearFormat: 'YYYY',
                certSeqLength: 4,
                certNextSeq: 10,
              },
            }),
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: InstrumentsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 'inst-1', frequency: '1 Year' }),
            update: jest.fn().mockResolvedValue({}),
            calculateDueDateFromFrequency: jest.fn().mockReturnValue(new Date('2027-01-01')),
          },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CalibrationService>(CalibrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute calibration creation within an atomic database transaction', async () => {
    const dto: any = {
      instrument_id: 'inst-1',
      calibration_date: '2026-10-01',
      created_by: 'user-1',
      companyId: 'comp-1',
      verdict: 'PASS',
      approval_status: 'Approved',
    };

    const result = await service.create(dto);

    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
    expect(result.id).toBe('cal-uuid-123');
    expect(result.certificate_number).toContain('CERT/');
  });
});
