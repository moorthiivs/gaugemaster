import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';

@ApiTags('api/Users')
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
  async removeUser(@Param('id') id: string) {
    return this.usersService.removeUser(id);
  }
}
