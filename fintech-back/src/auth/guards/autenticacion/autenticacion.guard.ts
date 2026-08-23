import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { CLAVE_RUTA_PUBLICA } from '../../decorators/publico.decorator';
import type {
  SolicitudAutenticada,
  UsuarioAutenticado,
} from '../../interfaces/usuario-autenticado.interface';

@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Revisa si el controlador o endpoint tiene @Publico().
    const esRutaPublica = this.reflector.getAllAndOverride<boolean>(
      CLAVE_RUTA_PUBLICA,
      [context.getHandler(), context.getClass()],
    );

    if (esRutaPublica) {
      return true;
    }

    const solicitud = context.switchToHttp().getRequest<SolicitudAutenticada>();

    const token = this.extraerToken(solicitud);

    if (!token) {
      throw new UnauthorizedException('Debes enviar un token de autenticación');
    }

    try {
      // Comprueba la firma y la fecha de expiración.
      const contenidoToken =
        await this.jwtService.verifyAsync<UsuarioAutenticado>(token);

      // Comprueba que el token tenga la información esperada.
      if (
        typeof contenidoToken.sub !== 'number' ||
        typeof contenidoToken.correo !== 'string' ||
        typeof contenidoToken.rol !== 'string'
      ) {
        throw new UnauthorizedException();
      }

      // Coloca los datos del usuario dentro de la petición.
      solicitud.usuario = contenidoToken;

      return true;
    } catch {
      throw new UnauthorizedException('El token es inválido o ha expirado');
    }
  }

  private extraerToken(solicitud: Request): string | undefined {
    const autorizacion = solicitud.headers.authorization;

    if (!autorizacion) {
      return undefined;
    }

    const [tipo, token] = autorizacion.trim().split(/\s+/);

    if (tipo?.toLowerCase() !== 'bearer') {
      return undefined;
    }

    return token;
  }
}
