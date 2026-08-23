import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [PrismaModule],
  controllers: [MovimientosController],
  providers: [MovimientosService],
})
export class MovimientosModule {}
