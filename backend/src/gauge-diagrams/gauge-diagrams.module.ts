import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GaugeDiagram } from './gauge-diagram.entity';
import { GaugeDiagramHistory } from './gauge-diagram-history.entity';
import { GaugeDiagramsService } from './gauge-diagrams.service';
import { GaugeDiagramsController } from './gauge-diagrams.controller';
import { User } from '../users/user.entity';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([GaugeDiagram, GaugeDiagramHistory, User]),
  ],
  controllers: [GaugeDiagramsController],
  providers: [GaugeDiagramsService, PermissionsGuard],
  exports: [GaugeDiagramsService],
})
export class GaugeDiagramsModule {}
