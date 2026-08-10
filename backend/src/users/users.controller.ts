import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
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
  async findAll(@Query('companyId') companyId?: string) {
    return this.usersService.findAll(companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
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
