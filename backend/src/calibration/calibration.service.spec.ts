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
import { ConflictException } from '@nestjs/common';
import { createMockRepository } from '../../test/utils/repository.mock';
import { Instrument } from '../instruments/instrument.entity';

describe('CalibrationService', () => {
  let service: CalibrationService;
  let mockCalibrationRepo: ReturnType<typeof createMockRepository>;
  let mockDataSource: any;
  // Repository used by the duplicate-calibration guard (both pre-check and in-transaction check)
  let guardRepo: ReturnType<typeof createMockRepository>;
  let mockManager: any;
  // Instrument lookups made by the early-recalibration check
  let instrumentRepo: ReturnType<typeof createMockRepository>;
  const repoFor = (entity: any) => (entity === Instrument ? instrumentRepo : guardRepo);

  beforeEach(async () => {
    mockCalibrationRepo = createMockRepository();
    guardRepo = createMockRepository();
    instrumentRepo = createMockRepository();
    (mockCalibrationRepo as any).manager = { getRepository: jest.fn(repoFor) };
    mockManager = {
      create: jest.fn((entity, data) => ({ ...data })),
      save: jest.fn((entity, data) => Promise.resolve({ id: 'cal-uuid-123', ...data })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn(repoFor),
    };
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb(mockManager)),
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
            findRawForAi: jest.fn().mockResolvedValue({ dueReminderThresholdDays: 15 }),
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
    // Certificate numbering uses its own query runner; it is covered elsewhere, so stub it here
    jest.spyOn(service, 'generateCertificateNumber').mockResolvedValue('CERT/2026/0010');
  });

  describe('duplicate calibration guard', () => {
    const baseDto: any = {
      instrument_id: 'inst-1',
      calibration_date: '2026-10-30',
      created_by: 'user-1',
      companyId: 'comp-1',
      verdict: 'PASS',
      approval_status: 'Calibration Completed',
    };

    it('rejects a new calibration while another one is still pending review/approval', async () => {
      guardRepo.findOne.mockResolvedValue({
        id: 'cal-old',
        certificate_number: 'CAL/CERT/2026/00362',
        approval_status: 'Pending Review',
      });

      await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
      expect(service.generateCertificateNumber).not.toHaveBeenCalled();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a second non-rejected calibration on the same calibration date', async () => {
      guardRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'cal-old', certificate_number: 'CAL/CERT/2026/00362' }),
      } as any);

      await expect(service.create(baseDto)).rejects.toThrow(/same calibration date/);
      expect(service.generateCertificateNumber).not.toHaveBeenCalled();
    });

    it('re-checks under an advisory lock inside the transaction and generates the number only after', async () => {
      const result = await service.create(baseDto);

      expect(mockManager.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        ['calibration-create:inst-1'],
      );
      const lockOrder = mockManager.query.mock.invocationCallOrder[0];
      const certOrder = (service.generateCertificateNumber as jest.Mock).mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(certOrder);
      expect(result.certificate_number).toBe('CERT/2026/0010');
    });

    it('blocks the second of two concurrent requests when the in-transaction check finds the first', async () => {
      // Pre-check (outside the transaction) sees nothing: both requests raced past it.
      // The re-check inside the transaction, after the advisory lock, sees the first request's record.
      const txCalibrationRepo = createMockRepository();
      txCalibrationRepo.findOne.mockResolvedValue({
        id: 'cal-first', certificate_number: 'CERT/2026/0010', approval_status: 'Calibration Completed',
      });
      mockManager.getRepository = jest.fn((entity: any) => (entity === Instrument ? instrumentRepo : txCalibrationRepo));

      await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
      expect(service.generateCertificateNumber).not.toHaveBeenCalled();
    });
  });

  describe('early recalibration (already calibrated, not yet due)', () => {
    const daysFromToday = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d;
    };
    const baseDto: any = {
      instrument_id: 'inst-1',
      calibration_date: new Date().toISOString().slice(0, 10),
      created_by: 'user-1',
      companyId: 'comp-1',
      verdict: 'PASS',
      approval_status: 'Calibration Completed',
    };

    it('reports "not_due" when the due date is beyond the reminder window', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(200), last_calibration_date: daysFromToday(-165),
      });
      const e = await service.getCalibrationEligibility('inst-1');
      expect(e.status).toBe('not_due');
    });

    it('reports "ok" when the instrument is due within the window or overdue', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(10), last_calibration_date: daysFromToday(-355),
      });
      expect((await service.getCalibrationEligibility('inst-1')).status).toBe('ok');

      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(-5), last_calibration_date: daysFromToday(-370),
      });
      expect((await service.getCalibrationEligibility('inst-1')).status).toBe('ok');
    });

    it('reports "pending" when a calibration is awaiting review/approval', async () => {
      guardRepo.findOne.mockResolvedValue({ id: 'c1', certificate_number: 'CAL/1', approval_status: 'Reviewed' });
      const e: any = await service.getCalibrationEligibility('inst-1');
      expect(e.status).toBe('pending');
      expect(e.pending.certificate_number).toBe('CAL/1');
    });

    it('blocks creating a calibration for a not-due instrument without a reason', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(200), last_calibration_date: daysFromToday(-165),
      });
      const err: any = await service.create(baseDto).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('EARLY_RECALIBRATION_REASON_REQUIRED');
      expect(service.generateCertificateNumber).not.toHaveBeenCalled();
    });

    it('rejects a too-short reason', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(200), last_calibration_date: daysFromToday(-165),
      });
      await expect(service.create({ ...baseDto, early_recalibration_reason: ' ok ' })).rejects.toThrow(ConflictException);
    });

    it('allows it with a confirmed reason and records the reason in the audit log', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(200), last_calibration_date: daysFromToday(-165),
      });
      const result = await service.create({ ...baseDto, early_recalibration_reason: 'Instrument dropped on floor' });
      expect(result.id).toBe('cal-uuid-123');
      const auditCall = mockManager.save.mock.calls.find(
        ([entity, data]: any[]) => entity === CalibrationAuditLog && String(data?.remarks).includes('Instrument dropped on floor'),
      );
      expect(auditCall).toBeDefined();
    });

    it('does not require a reason when recalibrating a rejected calibration', async () => {
      instrumentRepo.findOne.mockResolvedValue({
        id: 'inst-1', companyId: 'comp-1', due_date: daysFromToday(200), last_calibration_date: daysFromToday(-165),
      });
      const result = await service.create({ ...baseDto, recalibration_of_id: 'rejected-cal-1' });
      expect(result.id).toBe('cal-uuid-123');
    });
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

  describe('revertStage', () => {
    it('should revert a rejected calibration back to Pending Review and restore instrument stage with audit log', async () => {
      const mockRecord: any = {
        id: 'cal-rejected-1',
        instrument_id: 'inst-1',
        approval_status: 'Rejected',
        rejection_reason: 'Measurement drift exceeds tolerance limits',
        rejected_by: 'Reviewer Shivakumar',
        rejected_at: new Date(),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord);
      mockCalibrationRepo.save.mockImplementation((rec: any) => Promise.resolve({ ...rec }));

      const result = await service.revertStage(
        'cal-rejected-1',
        'Customer clarified tolerance spec via addendum',
        'Pending Review',
        { userId: 'user-1', name: 'Approver Quality' },
      );

      expect(result.approval_status).toBe('Pending Review');
      expect(result.rejection_reason).toBeUndefined();
      expect(result.rejected_by).toBeUndefined();
      expect(mockCalibrationRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if calibration is not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null as any);

      await expect(
        service.revertStage('non-existent', 'Note text', 'Pending Review'),
      ).rejects.toThrow();
    });
  });
});

