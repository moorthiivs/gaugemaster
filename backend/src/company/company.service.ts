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
    const now = new Date();
    const defaultExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30-day trial

    // 1. Create new company entity with default 30-day time-limited trial access
    const company = this.companyRepository.create({
      accessStatus: 'time_limited',
      accessStartDate: now,
      accessExpiryDate: defaultExpiry,
      ...createCompanyDto,
    });

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

  async findAll(): Promise<Company[]> {
    return this.companyRepository.find();
  }
}
