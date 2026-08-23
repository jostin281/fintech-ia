import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FiltrarPresupuestosDto {
  @ApiPropertyOptional({
    description: 'Mes que se desea consultar. Debe enviarse junto con el año',
    example: 8,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'El mes debe ser un número entero',
  })
  @Min(1, {
    message: 'El mes debe estar entre 1 y 12',
  })
  @Max(12, {
    message: 'El mes debe estar entre 1 y 12',
  })
  mes?: number;

  @ApiPropertyOptional({
    description: 'Año que se desea consultar. Debe enviarse junto con el mes',
    example: 2026,
    minimum: 1,
    maximum: 9999,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'El año debe ser un número entero',
  })
  @Min(1, {
    message: 'El año debe ser válido',
  })
  @Max(9999, {
    message: 'El año debe tener máximo cuatro dígitos',
  })
  anio?: number;
}
