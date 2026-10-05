import { Test, TestingModule } from '@nestjs/testing';
import { InstrumentsService } from './instruments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { User } from '../users/user.entity';
import { MailerService } from '../mail/mailer.service';
import { ValidationService } from '../validation/validation.service';
import { StatusNotificationService } from '../reminder/status-notification.service';
import { createMockRepository } from '../../test/utils/repository.mock';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InstrumentsService', () => {
  let service: InstrumentsService;
  let instrumentRepo: any;
  let historyRepo: any;

  beforeEach(async () => {
    instrumentRepo = { ...createMockRepository(), remove: jest.fn().mockResolvedValue(undefined) };
    historyRepo = { ...createMockRepository(), remove: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstrumentsService,
        { provide: getRepositoryToken(Instrument), useValue: instrumentRepo },
        { provide: getRepositoryToken(CalibrationHistory), useValue: historyRepo },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: MailerService, useValue: { sendMail: jest.fn() } },
        { provide: ValidationService, useValue: { validateData: jest.fn(), getRules: jest.fn().mockResolvedValue([]) } },
        { provide: StatusNotificationService, useValue: { sendDueReminders: jest.fn() } },
      ],
    }).compile();

    service = module.get<InstrumentsService>(InstrumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteHistoryRecord', () => {
    it('should throw NotFoundException if history record does not exist', async () => {
      historyRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteHistoryRecord('inst-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if history record belongs to different instrument', async () => {
      historyRepo.findOne.mockResolvedValue({
        id: 'hist-1',
        instrument: { id: 'other-inst' },
      });
      await expect(service.deleteHistoryRecord('inst-1', 'hist-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete history record and roll back instrument dates to previous cycle', async () => {
      const mockHistory = {
        id: 'hist-1',
        instrument: { id: 'inst-1' },
        last_calibration_date: new Date('2026-02-05'),
        due_date: new Date('2027-02-04'),
        calibration_source: 'External',
      };
      historyRepo.findOne.mockResolvedValue(mockHistory);
      historyRepo.find.mockResolvedValue([
        mockHistory,
      ]);

      const mockInstrument = {
        id: 'inst-1',
        name: 'CMM1',
        frequency: '12 Months',
        last_calibration_date: new Date('2026-02-05'),
        due_date: new Date('2027-02-04'),
        status: 'OK',
        calibration_source: 'External',
      };
      instrumentRepo.findOne.mockResolvedValue(mockInstrument);

      // Remaining histories after delete
      const prevCycle = {
        id: 'hist-0',
        instrument: { id: 'inst-1' },
        last_calibration_date: new Date('2025-02-05'),
        due_date: new Date('2026-02-04'),
        calibration_source: 'In-House',
        certificate_file: '/uploads/cert-prev.pdf',
      };

      // Mock find for duplicate cleanup (returns only current entry)
      historyRepo.find
        .mockResolvedValueOnce([mockHistory]) // for sameDateHistories
        .mockResolvedValueOnce([prevCycle]); // for remainingHistories

      instrumentRepo.query.mockResolvedValue([]); // no in-house matching

      const result = await service.deleteHistoryRecord('inst-1', 'hist-1');

      expect(historyRepo.remove).toHaveBeenCalledWith(mockHistory);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe('hist-1');
      expect(instrumentRepo.save).toHaveBeenCalled();
      expect(mockInstrument.last_calibration_date).toEqual(prevCycle.last_calibration_date);
      expect(mockInstrument.due_date).toEqual(prevCycle.due_date);
      expect(mockInstrument.calibration_source).toBe('In-House');
    });
  });
});
