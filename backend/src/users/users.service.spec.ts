import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Company } from '../company/entities/company.entity';
import { Role } from '../roles/role.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Company), useValue: createMockRepository() },
        { provide: getRepositoryToken(Role), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
