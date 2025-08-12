import { AuthService } from './auth.service';
import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        user: {
            sub: string;
            email: string;
            name: string;
        };
    }>;
    register(createUserDto: CreateUserDto): Promise<{
        accessToken: string;
        user: {
            sub: string;
            email: string;
            name: string;
        };
    }>;
    googleTokenLogin(token: string): Promise<{
        accessToken: string;
        user: {
            sub: string;
            email: string;
            name: string;
        };
    }>;
}
