import { Test, TestingModule } from '@nestjs/testing';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { GoogleDriveService } from '../backup/google-drive.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('InstrumentsController', () => {
  let controller: InstrumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstrumentsController],
      providers: [
        {
          provide: InstrumentsService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
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
});
