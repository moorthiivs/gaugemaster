import { Test, TestingModule } from '@nestjs/testing';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { GoogleDriveService } from '../backup/google-drive.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('InstrumentsController', () => {
  let controller: InstrumentsController;
  let service: any;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getHistory: jest.fn(),
      deleteHistoryRecord: jest.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstrumentsController],
      providers: [
        {
          provide: InstrumentsService,
          useValue: service,
        },
        {
          provide: GoogleDriveService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    controller = module.get<InstrumentsController>(InstrumentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call deleteHistoryRecord on deleteHistory', async () => {
    const res = await controller.deleteHistory('inst-1', 'hist-1');
    expect(service.deleteHistoryRecord).toHaveBeenCalledWith('inst-1', 'hist-1');
    expect(res).toEqual({ success: true, message: 'Deleted' });
  });
});
