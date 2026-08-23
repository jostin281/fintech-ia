// Global permite compartir el módulo en toda la aplicación.
import { Global, Module } from '@nestjs/common';

// Permite acceder a las variables del archivo .env.
import { ConfigModule } from '@nestjs/config';

// Servicio encargado de comunicarse con Prisma.
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
