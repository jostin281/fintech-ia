import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';

export class ActualizarPresupuestoDto {
  @ApiPropertyOptional({
    description: 'Nuevo monto máximo del presupuesto',
    example: 200,
    minimum: 0.01,
  })
  @Type(() => Number)
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'El monto límite debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto límite debe ser mayor que cero',
  })
  montoLimite?: number;

  @ApiPropertyOptional({
    description:
      'Porcentaje del presupuesto a partir del cual se genera una alerta',
    example: 75,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @ValidateIf((_objeto, valor) => valor !== undefined)
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
