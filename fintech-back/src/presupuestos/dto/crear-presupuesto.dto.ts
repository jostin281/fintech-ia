import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CrearPresupuestoDto {
  @ApiProperty({
    description: 'Identificador de una categoría activa de tipo GASTO',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({
    message: 'El identificador de la categoría debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de la categoría debe ser mayor que cero',
  })
  categoriaId: number;

  @ApiProperty({
    description: 'Cantidad máxima que el usuario desea gastar',
    example: 150,
    minimum: 0.01,
    maximum: 9999999999.99,
  })
  @Type(() => Number)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message:
        'El monto límite debe ser un número válido con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto límite debe ser mayor que cero',
  })
  @Max(9999999999.99, {
    message: 'El monto límite excede el valor permitido',
  })
  montoLimite: number;

  @ApiProperty({
    description: 'Mes correspondiente al presupuesto',
    example: 8,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt({
    message: 'El mes debe ser un número entero',
  })
  @Min(1, {
    message: 'El mes debe estar entre 1 y 12',
  })
  @Max(12, {
    message: 'El mes debe estar entre 1 y 12',
  })
  mes: number;

  @ApiProperty({
    description: 'Año correspondiente al presupuesto',
    example: 2026,
    minimum: 1,
    maximum: 9999,
  })
  @Type(() => Number)
  @IsInt({
    message: 'El año debe ser un número entero',
  })
  @Min(1, {
    message: 'El año debe ser válido',
  })
  @Max(9999, {
    message: 'El año debe tener máximo cuatro dígitos',
  })
  anio: number;

  @ApiPropertyOptional({
    description:
      'Porcentaje de consumo que activará una alerta. Si se omite, será 80',
    example: 80,
    minimum: 1,
    maximum: 100,
    default: 80,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'El porcentaje de alerta debe ser un número entero',
  })
  @Min(1, {
    message: 'El porcentaje de alerta debe ser mínimo 1',
  })
  @Max(100, {
    message: 'El porcentaje de alerta debe ser máximo 100',
  })
  porcentajeAlerta?: number;
}
