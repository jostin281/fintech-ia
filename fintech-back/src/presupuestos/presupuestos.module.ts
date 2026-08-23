import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';

@Module({
  imports: [PrismaModule],
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
