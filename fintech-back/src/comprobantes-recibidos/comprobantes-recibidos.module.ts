import { Module } from '@nestjs/common';

import { ComprobantesRecibidosController } from './comprobantes-recibidos.controller';
import { ComprobantesRecibidosService } from './comprobantes-recibidos.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';
import { ReglasCategorizacionController } from './reglas-categorizacion.controller';
import { ReglasCategorizacionService } from './reglas-categorizacion.service';
import { SriCredencialesController } from './sri-credenciales.controller';
import { SriCredencialesService } from './sri-credenciales.service';
import { SriDescargaProgramadaService } from './sri-descarga-programada.service';
import { SriDescargaRunnerService } from './sri-descarga-runner.service';

@Module({
  controllers: [
    ComprobantesRecibidosController,
    ProveedoresController,
    ReglasCategorizacionController,
    SriCredencialesController,
  ],
  providers: [
    ComprobantesRecibidosService,
    ProveedoresService,
    ReglasCategorizacionService,
    SriCredencialesService,
    SriDescargaRunnerService,
    SriDescargaProgramadaService,
  ],
})
export class ComprobantesRecibidosModule {}
