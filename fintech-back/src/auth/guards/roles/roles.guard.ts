import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CLAVE_ROLES } from '../../decorators/roles.decorator';
import type { RolPermitido } from '../../decorators/roles.decorator';
import type { SolicitudAutenticada } from '../../interfaces/usuario-autenticado.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtiene los roles colocados mediante @Roles().
    const rolesPermitidos = this.reflector.getAllAndOverride<RolPermitido[]>(
      CLAVE_ROLES,
      [context.getHandler(), context.getClass()],
    );

    // Si el endpoint no tiene @Roles(), cualquier
    // usuario autenticado puede utilizarlo.
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const solicitud = context.switchToHttp().getRequest<SolicitudAutenticada>();

    const usuario = solicitud.usuario;

    if (!usuario) {
      throw new UnauthorizedException('No se encontró un usuario autenticado');
    }

    const tienePermiso = rolesPermitidos.includes(usuario.rol);

    if (!tienePermiso) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

    return true;
  }
}
