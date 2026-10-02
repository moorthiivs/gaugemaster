import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            createCompanyRoles: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
