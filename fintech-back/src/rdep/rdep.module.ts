import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { BorradoresSriExportacionService } from '../facturacion/borradores-sri-exportacion.service';
import { AnexoRdepExcelService } from './anexo-rdep-excel.service';
import { RdepController } from './rdep.controller';
import { RdepPdfService } from './rdep-pdf.service';
import { RdepService } from './rdep.service';
import { RdepValidacionService } from './rdep-validacion.service';

/**
 * Módulo "Impuestos → Formulario 107 / RDEP": gestión persistida (con
 * historial de auditoría) del Formulario 107 y su Anexo RDEP, separado del
 * simulador rápido de FacturacionModule. Reutiliza
 * BorradoresSriExportacionService (ya usado por FacturacionModule para el
 * borrador rápido del 104/107) para no duplicar el dibujo del PDF; por eso
 * se declara aquí también como provider en vez de importar todo
 * FacturacionModule (que no lo exporta).
 */
@Module({
  imports: [PrismaModule],
  controllers: [RdepController],
  providers: [
    RdepService,
    RdepValidacionService,
    RdepPdfService,
    AnexoRdepExcelService,
    BorradoresSriExportacionService,
  ],
})
export class RdepModule {}
