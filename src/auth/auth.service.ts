// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from 'src/dto/create-user.dto';

@Injectable()
export class AuthService {
  private oauthClient: OAuth2Client;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.oauthClient = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
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
    const payload = { sub: user.id, email: user.email, name: user.name }
    return {
      accessToken: this.jwtService.sign(payload),
      user: payload,
    };
  }


  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    return {
      accessToken: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async loginWithGoogleToken(token: string) {
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

    const jwtPayload = { sub: user.id, email: user.email, name: user.name };
    return {
      accessToken: this.jwtService.sign(jwtPayload),
      user: jwtPayload,
    };
  }
}
