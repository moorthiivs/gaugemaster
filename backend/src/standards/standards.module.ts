import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Standard } from './standard.entity';
import { StandardHistory } from './standard-history.entity';
import { StandardsService } from './standards.service';
import { StandardsController } from './standards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Standard, StandardHistory])],
  controllers: [StandardsController],
  providers: [StandardsService],
  exports: [StandardsService],
})
export class StandardsModule {}

