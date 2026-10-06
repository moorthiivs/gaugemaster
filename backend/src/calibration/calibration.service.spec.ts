import { Test, TestingModule } from '@nestjs/testing';
import { CalibrationService } from './calibration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CalibrationAuditLog } from './calibration-audit-log.entity';
import { User } from '../users/user.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
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
        { provide: getRepositoryToken(CalibrationTemplate), useValue: createMockRepository() },
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

  it('should recalculate layout blocks and enforce FAIL verdict when measurements are out of tolerance', async () => {
    const dto: any = {
      instrument_id: 'inst-1',
      calibration_date: '2026-10-01',
      created_by: 'user-1',
      companyId: 'comp-1',
      verdict: 'PASS', // Client claims PASS falsely
      layout_blocks: [
        {
          type: 'table_grid',
          tolerance: 0.01,
          columns: [
            { id: 'nominal', label: 'Nominal', type: 'nominal' },
            { id: 'actual', label: 'Actual', type: 'reading' },
            { id: 'deviation', label: 'Deviation', type: 'formula', formula: 'actual - nominal' },
            { id: 'status', label: 'Status', type: 'status' },
          ],
          rows: [
            { nominal: 10.0, actual: 10.05 }, // Out of tolerance (0.05 > 0.01)
          ],
        },
      ],
    };

    const result = await service.create(dto);
    expect(result.calculated_verdict).toBe('FAIL');
    expect(result.verdict).toBe('FAIL'); // Overruled client claim
    expect(result.is_verdict_overridden).toBe(false);
    expect(result.layout_blocks![0].rows[0].deviation).toBe('+0.050');
  });

  it('should preserve manual verdict override when is_verdict_overridden is true with reason', async () => {
    const dto: any = {
      instrument_id: 'inst-1',
      calibration_date: '2026-10-01',
      created_by: 'user-1',
      companyId: 'comp-1',
      verdict: 'PASS', // Technician overrode to PASS under concession
      is_verdict_overridden: true,
      verdict_override_reason: 'Accepted under customer concession MRB-101',
      layout_blocks: [
        {
          type: 'table_grid',
          tolerance: 0.01,
          columns: [
            { id: 'nominal', label: 'Nominal', type: 'nominal' },
            { id: 'actual', label: 'Actual', type: 'reading' },
            { id: 'status', label: 'Status', type: 'status' },
          ],
          rows: [
            { nominal: 10.0, actual: 10.05 },
          ],
        },
      ],
    };

    const result = await service.create(dto);
    expect(result.calculated_verdict).toBe('FAIL'); // Raw math is FAIL
    expect(result.verdict).toBe('PASS'); // Preserved manual override
    expect(result.is_verdict_overridden).toBe(true);
    expect(result.verdict_override_reason).toBe('Accepted under customer concession MRB-101');
  });
});
