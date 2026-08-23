import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const MONTO_MAXIMO = 9_999_999_999.99;

export class ActualizarMetaAhorroDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre de la meta',
    example: 'Comprar una laptop para estudiar',
    maxLength: 100,
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @ValidateIf((_objeto: object, valor: unknown) => valor !== undefined)
  @IsString({
    message: 'El nombre debe ser un texto',
  })
  @IsNotEmpty({
    message: 'El nombre no puede estar vacío',
  })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres',
  })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Nuevo monto objetivo',
    example: 1500,
    minimum: 0.01,
    maximum: MONTO_MAXIMO,
  })
  @Type(() => Number)
  @ValidateIf((_objeto: object, valor: unknown) => valor !== undefined)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'El monto objetivo debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto objetivo debe ser mayor que cero',
  })
  @Max(MONTO_MAXIMO, {
    message: 'El monto objetivo supera el valor máximo permitido',
  })
  montoObjetivo?: number;

  @ApiPropertyOptional({
    description: 'Nueva fecha límite en formato YYYY-MM-DD',
    example: '2027-02-28',
    format: 'date',
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_objeto: object, valor: unknown) => valor !== undefined)
  @IsString({
    message: 'La fecha objetivo debe ser un texto',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha objetivo debe tener el formato YYYY-MM-DD',
  })
  @IsDateString(
    {
      strict: true,
    },
    {
      message: 'La fecha objetivo debe ser una fecha válida',
    },
  )
  fechaObjetivo?: string;
}
