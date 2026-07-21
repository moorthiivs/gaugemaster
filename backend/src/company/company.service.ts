import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UsersService } from 'src/users/users.service';


@Injectable()
export class CompanyService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) { }

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    // 1. Create new company entity
    const company = this.companyRepository.create(createCompanyDto);

    // 2. Save to generate company.id
    const savedCompany = await this.companyRepository.save(company);

    // 3. Update the user with the new companyId
    if (savedCompany.registeredUserId) {
      await this.usersService.updateCompany(
        savedCompany.id,
        savedCompany.registeredUserId,
      );
    }

    return savedCompany;
  }

}
