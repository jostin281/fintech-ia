import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { TipoMovimiento } from '../../generated/prisma/enums';

const fueEnviado = (_objeto: object, valor: unknown): boolean =>
  valor !== undefined;

const limpiarTextoOpcional = (parametros: TransformFnParams): unknown => {
  const valor: unknown = parametros.value;

  return typeof valor === 'string' ? valor.trim() : valor;
};

export class ActualizarMovimientoDto {
  @ApiPropertyOptional({
    description: 'Nuevo tipo del movimiento financiero',
    enum: TipoMovimiento,
    enumName: 'TipoMovimiento',
    example: TipoMovimiento.GASTO,
  })
  @ValidateIf(fueEnviado)
  @IsEnum(TipoMovimiento, {
    message: 'El tipo debe ser INGRESO o GASTO',
  })
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({
    description: 'Nuevo identificador de la categoría',
    example: 2,
  })
  @Type(() => Number)
  @ValidateIf(fueEnviado)
  @IsInt({
    message: 'El identificador de la categoría debe ser entero',
  })
  @Min(1, {
    message: 'El identificador de la categoría no es válido',
  })
  categoriaId?: number;

  @ApiPropertyOptional({
    description: 'Nuevo valor del ingreso o gasto',
    example: 30.5,
  })
  @Type(() => Number)
  @ValidateIf(fueEnviado)
  @IsNumber(
    {
      allowInfinity: false,
      allowNaN: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'El monto debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto debe ser mayor que cero',
  })
  @Max(9999999999.99, {
    message: 'El monto supera el valor permitido',
  })
  monto?: number;

  @ApiPropertyOptional({
    description: 'Nueva explicación breve del movimiento',
    example: 'Compra semanal de alimentos',
  })
  @Transform(limpiarTextoOpcional)
  @ValidateIf(fueEnviado)
  @IsString({
    message: 'La descripción debe ser texto',
  })
  @IsNotEmpty({
    message: 'La descripción no puede estar vacía',
  })
  @MaxLength(255, {
    message: 'La descripción no puede superar los 255 caracteres',
  })
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Nueva fecha del movimiento',
    example: '2026-08-08T10:30:00-05:00',
  })
  @ValidateIf(fueEnviado)
  @IsDateString(
    {},
    {
      message: 'La fecha debe tener un formato válido',
    },
  )
  fecha?: string;
}
