import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CLAVE_BLOQUEADO_EN_DEMO } from '../../decorators/bloqueado-en-demo.decorator';
import type { SolicitudAutenticada } from '../../interfaces/usuario-autenticado.interface';

// Bloquea a las cuentas demo el acceso a los endpoints marcados con
// @BloqueadoEnDemo(). Corre después de AutenticacionGuard, así que
// solicitud.usuario ya está disponible (o la ruta es pública y no aplica).
@Injectable()
export class SinDemoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const bloqueado = this.reflector.getAllAndOverride<boolean>(
      CLAVE_BLOQUEADO_EN_DEMO,
      [context.getHandler(), context.getClass()],
    );

    if (!bloqueado) {
      return true;
    }

    const solicitud = context.switchToHttp().getRequest<SolicitudAutenticada>();

    if (solicitud.usuario?.esDemo) {
      throw new ForbiddenException(
        'Esta función no está disponible en el modo demo. Crea una cuenta gratis para usarla.',
      );
    }

    return true;
  }
}
