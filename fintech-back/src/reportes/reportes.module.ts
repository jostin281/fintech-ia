import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ReportesController } from './reportes.controller';
import { ReportesExportacionService } from './reportes-exportacion.service';
import { ReportesService } from './reportes.service';

@Module({
  controllers: [ReportesController],

  providers: [ReportesService, ReportesExportacionService, PrismaService],
})
export class ReportesModule {}
