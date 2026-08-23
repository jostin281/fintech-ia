import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, PrismaService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
