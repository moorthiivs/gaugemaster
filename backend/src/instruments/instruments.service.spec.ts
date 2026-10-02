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

describe('InstrumentsService', () => {
  let service: InstrumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstrumentsService,
        { provide: getRepositoryToken(Instrument), useValue: createMockRepository() },
        { provide: getRepositoryToken(CalibrationHistory), useValue: createMockRepository() },
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
});
