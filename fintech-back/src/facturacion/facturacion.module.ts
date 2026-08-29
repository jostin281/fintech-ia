import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { BorradoresSriExportacionService } from './borradores-sri-exportacion.service';
import { ClientesFacturacionController } from './clientes-facturacion.controller';
import { ClientesFacturacionService } from './clientes-facturacion.service';
import { ConsultaRucSriService } from './consulta-ruc-sri.service';
import { FacturasController } from './facturas.controller';
import { FacturasService } from './facturas.service';
import { FirmaElectronicaController } from './firma-electronica.controller';
import { FirmaElectronicaService } from './firma-electronica.service';
import { MailerService } from '../notificaciones/mailer.service';
import { PerfilTributarioController } from './perfil-tributario.controller';
import { PerfilTributarioService } from './perfil-tributario.service';
import { ProductosServiciosController } from './productos-servicios.controller';
import { ProductosServiciosService } from './productos-servicios.service';
import { ResumenTributarioController } from './resumen-tributario.controller';
import { ResumenTributarioService } from './resumen-tributario.service';
import { RetencionesRecibidasController } from './retenciones-recibidas.controller';
import { RetencionesRecibidasService } from './retenciones-recibidas.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [
    PerfilTributarioController,
    FirmaElectronicaController,
    ClientesFacturacionController,
    ProductosServiciosController,
    FacturasController,
    RetencionesRecibidasController,
    ResumenTributarioController,
  ],
  providers: [
    PerfilTributarioService,
    ConsultaRucSriService,
    FirmaElectronicaService,
    MailerService,
    ClientesFacturacionService,
    ProductosServiciosService,
    FacturasService,
    RetencionesRecibidasService,
    ResumenTributarioService,
    BorradoresSriExportacionService,
  ],
  exports: [FacturasService, ResumenTributarioService],
})
export class FacturacionModule {}
