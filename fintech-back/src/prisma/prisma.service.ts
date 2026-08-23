// Injectable permite que NestJS administre y comparta este servicio.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

// Permite leer las variables privadas almacenadas en .env.
import { ConfigService } from '@nestjs/config';

// Adaptador que permite conectar Prisma 7 con PostgreSQL.
import { PrismaPg } from '@prisma/adapter-pg';

// Cliente generado automáticamente desde schema.prisma.
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    // Obtiene la dirección de PostgreSQL desde el archivo .env.
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');

    // Prepara el adaptador que realizará la conexión.
    const adapter = new PrismaPg({
      connectionString,
    });

    // Entrega el adaptador al cliente de Prisma.
    super({
      adapter,
    });
  }

  // Abre la conexión cuando inicia la aplicación.
  async onModuleInit() {
    await this.$connect();
  }

  // Cierra la conexión cuando se detiene la aplicación.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
