import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { Company } from '../company/entities/company.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([Company, Role, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'gaugemaster',
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, PermissionsGuard],
  exports: [AuthService, JwtStrategy, GoogleStrategy, PermissionsGuard, PassportModule, JwtModule, TypeOrmModule],
})
export class AuthModule {}
