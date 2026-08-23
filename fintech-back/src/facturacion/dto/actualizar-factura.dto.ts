import { PartialType } from '@nestjs/swagger';

import { CrearFacturaDto } from './crear-factura.dto';

// Solo se aplica a comprobantes en estado BORRADOR.
export class ActualizarFacturaDto extends PartialType(CrearFacturaDto) {}
