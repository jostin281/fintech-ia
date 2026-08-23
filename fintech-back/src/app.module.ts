// Module permite organizar la aplicación.
import { Module } from '@nestjs/common';

// Permite cargar las variables almacenadas en .env.
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoriasModule } from './categorias/categorias.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { MetasAhorroModule } from './metas-ahorro/metas-ahorro.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ReportesModule } from './reportes/reportes.module';
import { AsistenteIaModule } from './asistente-ia/asistente-ia.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { ComprobantesRecibidosModule } from './comprobantes-recibidos/comprobantes-recibidos.module';
import { RdepModule } from './rdep/rdep.module';

@Module({
  imports: [
    // Lee el archivo .env y comparte sus variables.
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CategoriasModule,
    UsuariosModule,
    AuthModule,
    MovimientosModule,
    PresupuestosModule,
    MetasAhorroModule,
    NotificacionesModule,
    ReportesModule,
    AsistenteIaModule,
    FacturacionModule,
    ComprobantesRecibidosModule,
    RdepModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
