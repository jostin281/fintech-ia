import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MetasAhorroController } from './metas-ahorro.controller';
import { MetasAhorroService } from './metas-ahorro.service';

@Module({
  imports: [PrismaModule],
  controllers: [MetasAhorroController],
  providers: [MetasAhorroService],
  exports: [MetasAhorroService],
})
export class MetasAhorroModule {}
