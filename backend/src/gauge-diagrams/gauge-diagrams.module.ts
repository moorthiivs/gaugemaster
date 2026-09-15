import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GaugeDiagram } from './gauge-diagram.entity';
import { GaugeDiagramHistory } from './gauge-diagram-history.entity';
import { GaugeDiagramsService } from './gauge-diagrams.service';
import { GaugeDiagramsController } from './gauge-diagrams.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GaugeDiagram, GaugeDiagramHistory]),
  ],
  controllers: [GaugeDiagramsController],
  providers: [GaugeDiagramsService],
  exports: [GaugeDiagramsService],
})
export class GaugeDiagramsModule {}
