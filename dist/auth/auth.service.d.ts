import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
export declare class AuthService {
    private readonly jwtService;
    private readonly configService;
    private readonly usersService;
    private oauthClient;
    constructor(jwtService: JwtService, configService: ConfigService, usersService: UsersService);
    validateUser(profile: any): Promise<{
        accessToken: string;
        user: {
            sub: any;
            email: any;
            name: any;
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
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        user: {
            sub: string;
            email: string;
            name: string;
        };
    }>;
    loginWithGoogleToken(token: string): Promise<{
        accessToken: string;
        user: {
            sub: string;
            email: string;
            name: string;
        };
    }>;
}
