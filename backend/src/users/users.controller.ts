import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
  Req,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@ApiTags('api/Users')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller(['api/users', 'users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  async findAll(@Req() req: any, @Query('companyId') queryCompanyId?: string) {
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || req.user?.companyId) : req.user?.companyId;
    return this.usersService.findAll(effectiveCompanyId);
  }

  @Get(':id')
  @RequirePermission('users', 'view')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const user = await this.usersService.findOne(id);
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    if (!isSuperAdmin && user.companyId && req.user?.companyId && user.companyId !== req.user.companyId) {
      throw new ForbiddenException('Access denied to user outside your company');
    }
    return user;
  }

  @Post('register')
  @ApiBody({ type: CreateUserDto })
  register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post()
  @RequirePermission('users', 'create')
  async createUser(
    @Body()
    body: {
      name: string;
      email: string;
      password?: string;
      roleId?: string;
      designation?: string;
      signature?: string;
      additionalEmails?: string[];
      companyId?: string;
    },
  ) {
    return this.usersService.createUser(body);
  }

  @Patch(':id')
  @RequirePermission('users', 'edit')
  async updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      email?: string;
      password?: string;
      roleId?: string;
      designation?: string;
      signature?: string;
      additionalEmails?: string[];
      companyId?: string;
    },
  ) {
    return this.usersService.updateUser(id, body);
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  async removeUser(@Param('id') id: string) {
    return this.usersService.removeUser(id);
  }
}
