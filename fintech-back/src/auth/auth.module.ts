import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoService } from './demo.service';
import { DemoLimpiezaService } from './demo-limpieza.service';
import { AutenticacionGuard } from './guards/autenticacion/autenticacion.guard';
import { RolesGuard } from './guards/roles/roles.guard';
import { SinDemoGuard } from './guards/sin-demo/sin-demo.guard';

@Module({
  imports: [
    UsuariosModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DemoService,
    DemoLimpiezaService,

    // Primero comprueba el token.
    {
      provide: APP_GUARD,
      useClass: AutenticacionGuard,
    },

    // Después comprueba el rol.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Por último bloquea a las cuentas demo el uso de funciones
    // marcadas con @BloqueadoEnDemo() (SRI, firma electrónica,
    // facturación, RDEP).
    {
      provide: APP_GUARD,
      useClass: SinDemoGuard,
    },
  ],
})
export class AuthModule {}
