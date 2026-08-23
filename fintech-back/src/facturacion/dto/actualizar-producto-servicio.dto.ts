import { PartialType } from '@nestjs/swagger';

import { CrearProductoServicioDto } from './crear-producto-servicio.dto';

export class ActualizarProductoServicioDto extends PartialType(
  CrearProductoServicioDto,
) {}
