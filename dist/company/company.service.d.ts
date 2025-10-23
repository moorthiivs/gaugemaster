import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UsersService } from 'src/users/users.service';
export declare class CompanyService {
    private readonly usersService;
    private readonly companyRepository;
    constructor(usersService: UsersService, companyRepository: Repository<Company>);
    create(createCompanyDto: CreateCompanyDto): Promise<Company>;
}
