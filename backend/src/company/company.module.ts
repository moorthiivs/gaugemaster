import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from 'src/users/user.entity';
import { UsersModule } from 'src/users/users.module';  

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, User]),
    UsersModule,   // ✅ Add this so UsersService is available
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule { }
