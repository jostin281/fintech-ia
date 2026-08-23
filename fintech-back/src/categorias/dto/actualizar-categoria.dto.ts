// PartialType reutiliza las validaciones del DTO de creación,
// pero convierte todos sus campos en opcionales.
import { PartialType } from '@nestjs/swagger';

import { CrearCategoriaDto } from './crear-categoria.dto';

export class ActualizarCategoriaDto extends PartialType(CrearCategoriaDto) {}
