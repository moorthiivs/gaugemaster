// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { Company } from 'src/company/entities/company.entity';
import { Role } from 'src/roles/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, Role])], // <-- THIS is required
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
