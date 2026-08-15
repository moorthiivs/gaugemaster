// src/auth/auth.service.ts
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../company/entities/company.entity';
import { Role } from '../roles/role.entity';

@Injectable()
export class AuthService {
  private oauthClient: OAuth2Client | null = null;
  private readonly googleEnabled: boolean;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    this.googleEnabled = !!clientId;
    if (this.googleEnabled) {
      this.oauthClient = new OAuth2Client(clientId);
    }
  }

  /** Returns which auth features are enabled for this deployment */
  getAuthConfig() {
    return {
      googleEnabled: this.googleEnabled,
      passwordEnabled: true,
      registrationEnabled: false, // Admin creates users; no public signup
    };
  }

  async validateUser(profile: any) {
    const payload = {
      sub: profile.id,
      email: profile.email,
      name: profile.name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: payload,
    };
  }


  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const roleName = user.role?.name || user.roleId || 'Admin';
    const payload = { sub: user.id, email: user.email, name: user.name, role: roleName, userRole: user.role, onboarded: user.onboarded, companyId: user.companyId, isSuperAdmin: user.isSuperAdmin || false };
    return {
      accessToken: this.jwtService.sign(payload),
      user: payload,
    };
  }


  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Super Admin bypass — no company access check needed
    if (user.isSuperAdmin) {
      const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: 'SuperAdmin',
        isSuperAdmin: true,
        onboarded: true,
        companyId: user.companyId || null,
      };
      return {
        accessToken: this.jwtService.sign(payload),
        user: payload,
      };
    }

    // Regular user — check company access status
    let targetCompany: Company | null = null;
    if (user.companyId) {
      targetCompany = await this.companyRepository.findOne({ where: { id: user.companyId } });
      if (targetCompany) {
        if (targetCompany.accessStatus === 'disabled') {
          throw new ForbiddenException('Your company access has been disabled. Contact administrator.');
        }
        if (targetCompany.accessStatus === 'time_limited') {
          const now = new Date();
          if (targetCompany.accessStartDate && now < targetCompany.accessStartDate) {
            throw new ForbiddenException('Your company access has not started yet. Contact administrator.');
          }
          if (targetCompany.accessExpiryDate && now > targetCompany.accessExpiryDate) {
            throw new ForbiddenException('Your company access has expired. Contact administrator.');
          }
        }
      }
    }

    let userRole: Role | null | undefined = user.role;
    if (user.companyId && (!userRole || !user.roleId)) {
      userRole = await this.roleRepository.findOne({
        where: [{ companyId: user.companyId, name: 'Admin' }, { name: 'Admin', isSystemDefault: true }],
      });
      if (userRole && !user.roleId) {
        user.roleId = userRole.id;
        user.role = userRole;
        await this.usersService.updateUser(user.id, { roleId: userRole.id });
      }
    }

    const roleName = userRole?.name || user.roleId || 'Admin';
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: roleName,
      userRole: userRole || user.role,
      onboarded: user.onboarded,
      companyId: user.companyId,
      isSuperAdmin: false,
      companyAccess: targetCompany ? {
        status: targetCompany.accessStatus,
        startDate: targetCompany.accessStartDate,
        expiryDate: targetCompany.accessExpiryDate,
      } : null,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async loginWithGoogleToken(token: string) {
    if (!this.googleEnabled || !this.oauthClient) {
      throw new BadRequestException('Google authentication is not configured for this deployment');
    }

    const ticket = await this.oauthClient.verifyIdToken({
      idToken: token,
      audience: this.configService.get('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload || {}

    if (!googleId || !email || !name) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.usersService.findOrCreateByGoogleProfile({ id: googleId, email, name });

    // Check company access for Google login too
    if (user.companyId && !user.isSuperAdmin) {
      const company = await this.companyRepository.findOne({ where: { id: user.companyId } });
      if (company) {
        if (company.accessStatus === 'disabled') {
          throw new ForbiddenException('Your company access has been disabled. Contact administrator.');
        }
        if (company.accessStatus === 'time_limited') {
          const now = new Date();
          if (company.accessStartDate && now < company.accessStartDate) {
            throw new ForbiddenException('Your company access has not started yet. Contact administrator.');
          }
          if (company.accessExpiryDate && now > company.accessExpiryDate) {
            throw new ForbiddenException('Your company access has expired. Contact administrator.');
          }
        }
      }
    }

    const jwtPayload = { sub: user.id, email: user.email, name: user.name, onboarded: user.onboarded, companyId: user.companyId, isSuperAdmin: user.isSuperAdmin || false };
    return {
      accessToken: this.jwtService.sign(jwtPayload),
      user: jwtPayload,
    };
  }
}
