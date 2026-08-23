import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TipoMovimiento } from '../../generated/prisma/enums';

const limpiarTextoOpcional = (parametros: TransformFnParams): unknown => {
  const valor: unknown = parametros.value;

  return typeof valor === 'string' ? valor.trim() : valor;
};

export class CrearMovimientoDto {
  @ApiProperty({
    description: 'Tipo de movimiento financiero',
    enum: TipoMovimiento,
    enumName: 'TipoMovimiento',
    example: TipoMovimiento.GASTO,
  })
  @IsEnum(TipoMovimiento, {
    message: 'El tipo debe ser INGRESO o GASTO',
  })
  tipo!: TipoMovimiento;

  @ApiProperty({
    description: 'Identificador de la categoría',
    example: 2,
  })
  @Type(() => Number)
  @IsInt({
    message: 'El identificador de la categoría debe ser entero',
  })
  @Min(1, {
    message: 'El identificador de la categoría no es válido',
  })
  categoriaId!: number;

  @ApiProperty({
    description: 'Valor del ingreso o gasto',
    example: 25.5,
  })
  @Type(() => Number)
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
  monto!: number;

  @ApiPropertyOptional({
    description: 'Explicación breve del movimiento',
    example: 'Compra de alimentos',
  })
  @Transform(limpiarTextoOpcional)
  @IsOptional()
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
    description:
      'Fecha del movimiento. Si no se envía, se utiliza la fecha actual',
    example: '2026-08-07T19:30:00-05:00',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'La fecha debe tener un formato válido',
    },
  )
  fecha?: string;
}
