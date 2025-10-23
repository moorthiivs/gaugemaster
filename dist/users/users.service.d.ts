import { User } from './user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { Company } from 'src/company/entities/company.entity';
export declare class UsersService {
    private readonly userRepository;
    private readonly companyRepository;
    constructor(userRepository: Repository<User>, companyRepository: Repository<Company>);
    private users;
    findByEmail(email: string): Promise<User | null>;
    create(createUserDto: CreateUserDto): Promise<User>;
    findOrCreateByGoogleProfile(profile: {
        id: string;
        email: string;
        name: string;
    }): Promise<User>;
    updateCompany(companyId: string, userId: string): Promise<{
        message: string;
        user: User;
    }>;
}
