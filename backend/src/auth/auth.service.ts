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
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    return {
      googleEnabled: this.googleEnabled,
      googleClientId: clientId || null,
      passwordEnabled: true,
      registrationEnabled: false, // Admin creates users; no public signup
    };
  }

  /** Helper to generate Access Token (15m) and Refresh Token (7d) */
  private generateTokens(payload: any) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'gaugemaster';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || `${jwtSecret}_refresh`;
    const accessTokenExpiry = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: accessTokenExpiry,
    });

    const refreshPayload = {
      sub: payload.sub,
      email: payload.email,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshTokenExpiry,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: payload,
    };
  }

  async validateUser(profile: any) {
    const payload = {
      sub: profile.id,
      email: profile.email,
      name: profile.name,
    };

    return this.generateTokens(payload);
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const roleName = user.role?.name || user.roleId || 'Admin';
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: roleName,
      userRole: user.role,
      onboarded: user.onboarded,
      companyId: user.companyId,
      isSuperAdmin: user.isSuperAdmin || false,
    };
    return this.generateTokens(payload);
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
      return this.generateTokens(payload);
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
    return this.generateTokens(payload);
  }

  async loginWithGoogleToken(token: string) {
    if (!this.googleEnabled || !this.oauthClient) {
      throw new BadRequestException('Google authentication is not configured for this deployment');
    }

    let googleId: string | undefined;
    let email: string | undefined;
    let name: string | undefined;

    // 1. Try ID token verification first (if an ID token was passed)
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      googleId = payload?.sub;
      email = payload?.email;
      name = payload?.name;
    } catch {
      // 2. If ID token verification fails, verify as OAuth2 access token via Google userinfo
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userInfoRes.ok) {
          const data: any = await userInfoRes.json();
          googleId = data.sub || data.id;
          email = data.email;
          name = data.name || (data.email ? data.email.split('@')[0] : 'User');
        } else {
          const errText = await userInfoRes.text();
          console.error('[AuthService] Google userinfo fetch failed:', userInfoRes.status, errText);
        }
      } catch (fetchErr) {
        console.error('[AuthService] Failed to fetch Google userinfo with access token:', fetchErr);
      }
    }

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

    const roleName = user.role?.name || user.roleId || (user.isSuperAdmin ? 'SuperAdmin' : 'Admin');
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: roleName,
      userRole: user.role,
      onboarded: user.onboarded,
      companyId: user.companyId,
      isSuperAdmin: user.isSuperAdmin || false,
    };
    return this.generateTokens(jwtPayload);
  }

  /**
   * Refreshes access and refresh tokens using a valid refresh token.
   * Validates user existence and current company access status.
   */
  async refreshToken(refreshTokenStr: string) {
    if (!refreshTokenStr) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'gaugemaster';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || `${jwtSecret}_refresh`;

    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshTokenStr, { secret: refreshSecret });
    } catch (err: any) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const user = await this.usersService.findOne(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or account no longer active');
    }

    // Verify company status if not superadmin
    if (user.companyId && !user.isSuperAdmin && user.company) {
      if (user.company.accessStatus === 'disabled') {
        throw new ForbiddenException('Your company access has been disabled. Contact administrator.');
      }
      if (user.company.accessStatus === 'time_limited') {
        const now = new Date();
        if (user.company.accessStartDate && now < user.company.accessStartDate) {
          throw new ForbiddenException('Your company access has not started yet. Contact administrator.');
        }
        if (user.company.accessExpiryDate && now > user.company.accessExpiryDate) {
          throw new ForbiddenException('Your company access has expired. Contact administrator.');
        }
      }
    }

    const roleName = user.role?.name || user.roleId || (user.isSuperAdmin ? 'SuperAdmin' : 'Admin');
    const newPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.isSuperAdmin ? 'SuperAdmin' : roleName,
      userRole: user.role,
      onboarded: user.onboarded,
      companyId: user.companyId || null,
      isSuperAdmin: user.isSuperAdmin || false,
      companyAccess: user.company ? {
        status: user.company.accessStatus,
        startDate: user.company.accessStartDate,
        expiryDate: user.company.accessExpiryDate,
      } : null,
    };

    return this.generateTokens(newPayload);
  }
}
