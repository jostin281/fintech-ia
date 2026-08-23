import { Module } from '@nestjs/common';

import { ComprobantesRecibidosController } from './comprobantes-recibidos.controller';
import { ComprobantesRecibidosService } from './comprobantes-recibidos.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';
import { ReglasCategorizacionController } from './reglas-categorizacion.controller';
import { ReglasCategorizacionService } from './reglas-categorizacion.service';

@Module({
  controllers: [
    ComprobantesRecibidosController,
    ProveedoresController,
    ReglasCategorizacionController,
  ],
  providers: [
    ComprobantesRecibidosService,
    ProveedoresService,
    ReglasCategorizacionService,
  ],
})
export class ComprobantesRecibidosModule {}
