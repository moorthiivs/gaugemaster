import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { User } from '../users/user.entity';
import { Company } from '../company/entities/company.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, Company])],
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
  exports: [RolesService],
})
export class RolesModule {}

