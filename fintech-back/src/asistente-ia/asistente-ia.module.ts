import { Module } from '@nestjs/common';

import { MetasAhorroModule } from '../metas-ahorro/metas-ahorro.module';
import { PresupuestosModule } from '../presupuestos/presupuestos.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AsistenteIaController } from './asistente-ia.controller';
import { AsistenteIaService } from './asistente-ia.service';
import { ConocimientoAsistenteService } from './conocimiento-asistente.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [PrismaModule, PresupuestosModule, MetasAhorroModule],
  controllers: [AsistenteIaController],
  providers: [AsistenteIaService, GeminiService, ConocimientoAsistenteService],
})
export class AsistenteIaModule {}
