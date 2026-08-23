import { SetMetadata } from '@nestjs/common';

import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

// Nombre utilizado para guardar los roles requeridos.
export const CLAVE_ROLES = 'rolesPermitidos';

// Solo acepta los roles definidos en UsuarioAutenticado.
export type RolPermitido = UsuarioAutenticado['rol'];

// Permite indicar qué roles pueden ejecutar un endpoint.
export const Roles = (...roles: RolPermitido[]) =>
  SetMetadata(CLAVE_ROLES, roles);
