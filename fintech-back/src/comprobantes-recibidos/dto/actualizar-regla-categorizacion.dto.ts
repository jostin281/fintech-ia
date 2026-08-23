// PartialType reutiliza las validaciones de creación y las vuelve
// opcionales; OmitType quita "alcance" porque el alcance de una regla
// (GLOBAL o PERSONAL) no se puede cambiar después de creada, solo su
// palabra clave, categoría, prioridad o estado.
import { OmitType, PartialType } from '@nestjs/swagger';

import { CrearReglaCategorizacionDto } from './crear-regla-categorizacion.dto';

export class ActualizarReglaCategorizacionDto extends PartialType(
  OmitType(CrearReglaCategorizacionDto, ['alcance'] as const),
) {}
