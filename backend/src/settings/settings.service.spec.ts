import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { LocationEmail } from './entities/location-email.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(Setting),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(LocationEmail),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
