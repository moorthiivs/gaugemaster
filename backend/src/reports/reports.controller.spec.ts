import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            generateReport: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
