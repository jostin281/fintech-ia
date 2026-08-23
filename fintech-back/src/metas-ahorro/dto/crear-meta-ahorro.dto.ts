import { ApiProperty } from '@nestjs/swagger';
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
} from 'class-validator';

const MONTO_MAXIMO = 9_999_999_999.99;

export class CrearMetaAhorroDto {
  @ApiProperty({
    description: 'Nombre de la meta de ahorro',
    example: 'Comprar una laptop',
    maxLength: 100,
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({
    message: 'El nombre debe ser un texto',
  })
  @IsNotEmpty({
    message: 'El nombre es obligatorio',
  })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres',
  })
  nombre!: string;

  @ApiProperty({
    description: 'Cantidad de dinero que se desea ahorrar',
    example: 1200,
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
      message: 'El monto objetivo debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto objetivo debe ser mayor que cero',
  })
  @Max(MONTO_MAXIMO, {
    message: 'El monto objetivo supera el valor máximo permitido',
  })
  montoObjetivo!: number;

  @ApiProperty({
    description: 'Fecha límite de la meta en formato YYYY-MM-DD',
    example: '2026-12-15',
    format: 'date',
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
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
  fechaObjetivo!: string;
}
