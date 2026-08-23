import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

const MONTO_MAXIMO = 9_999_999_999.99;

export class CrearAporteMetaDto {
  @ApiProperty({
    description: 'Cantidad que se agregará al ahorro de la meta',
    example: 100,
    minimum: 0.01,
    maximum: MONTO_MAXIMO,
  })
  @Type(() => Number)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'El aporte debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El aporte debe ser mayor que cero',
  })
  @Max(MONTO_MAXIMO, {
    message: 'El aporte supera el valor máximo permitido',
  })
  monto!: number;
}
