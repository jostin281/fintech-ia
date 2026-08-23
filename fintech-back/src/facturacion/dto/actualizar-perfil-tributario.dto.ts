import { PartialType } from '@nestjs/swagger';

import { CrearPerfilTributarioDto } from './crear-perfil-tributario.dto';

// Todos los datos del perfil son opcionales durante una actualización.
// ambienteSri, activo y usuarioId no aparecen y no pueden alterarse desde aquí.
export class ActualizarPerfilTributarioDto extends PartialType(
  CrearPerfilTributarioDto,
) {}
