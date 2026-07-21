import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationRule } from './validation-rule.entity';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRule])],
  providers: [ValidationService],
  controllers: [ValidationController],
  exports: [ValidationService],
})
export class ValidationModule {}
