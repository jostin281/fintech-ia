import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const ESTADOS_FACTURA = [
  'BORRADOR',
  'FIRMADA',
  'RECIBIDA',
  'AUTORIZADA',
  'DEVUELTA',
  'NO_AUTORIZADA',
  'ANULADA_LOCAL',
  'ERROR',
] as const;

export class FiltrarFacturasDto {
  @ApiPropertyOptional({ enum: ESTADOS_FACTURA })
  @IsOptional()
  @IsIn(ESTADOS_FACTURA, { message: 'El estado de factura no es válido' })
  estado?: (typeof ESTADOS_FACTURA)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 12, example: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El mes debe ser entero' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  mes?: number;

  @ApiPropertyOptional({ minimum: 2020, maximum: 9999, example: 2026 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El año debe ser entero' })
  @Min(2020, { message: 'El año debe ser 2020 o posterior' })
  @Max(9999, { message: 'El año admite máximo cuatro dígitos' })
  anio?: number;
}
