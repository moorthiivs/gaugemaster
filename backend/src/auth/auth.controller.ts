import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';

@ApiTags('api/auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /** Public endpoint — tells the frontend which auth options are available */
  @Get('config')
  @ApiOperation({ summary: 'Get authentication configuration' })
  @ApiResponse({ status: 200, description: 'Returns enabled auth methods' })
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT tokens and user info' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'Returns JWT tokens and user info' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('google/token')
  @ApiOperation({ summary: 'Login with Google OAuth token' })
  @ApiResponse({ status: 200, description: 'Returns JWT tokens and user info' })
  async googleTokenLogin(@Body('token') token: string) {
    return this.authService.loginWithGoogleToken(token);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'Returns refreshed JWT access and refresh tokens' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear session' })
  @ApiResponse({ status: 200, description: 'Session terminated' })
  async logout() {
    return { success: true, message: 'Logged out successfully' };
  }
}

