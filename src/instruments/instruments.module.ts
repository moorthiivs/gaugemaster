import { Module } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';
import { InstrumentsController } from './instruments.controller';
import { Instrument } from './instrument.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Instrument])], // <-- THIS is required
  controllers: [InstrumentsController],
  providers: [InstrumentsService],
})
export class InstrumentsModule { }