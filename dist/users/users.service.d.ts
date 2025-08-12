import { User } from './user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    private users;
    findByEmail(email: string): Promise<User | null>;
    create(createUserDto: CreateUserDto): Promise<User>;
    findOrCreateByGoogleProfile(profile: {
        id: string;
        email: string;
        name: string;
    }): Promise<User>;
}
