import { ApiProperty } from '@nestjs/swagger';

// Permite limpiar o transformar datos antes de validarlos.
import { Transform } from 'class-transformer';

// Decoradores que contienen las reglas de validación.
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Enum generado por Prisma desde schema.prisma.
import { TipoMovimiento } from '../../generated/prisma/enums';

export class CrearCategoriaDto {
  @ApiProperty({
    description: 'Nombre de la categoría financiera',
    example: 'Alimentación',
    maxLength: 100,
  })
  // Elimina espacios al inicio y al final.
  @Transform(({ value }) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
  @Matches(/^[\p{L} ]+$/u, {
    message: 'El nombre solamente puede contener letras y espacios',
  })
  nombre!: string;

  @ApiProperty({
    description: 'Indica si la categoría corresponde a un ingreso o gasto',
    enum: TipoMovimiento,
    enumName: 'TipoMovimiento',
    example: TipoMovimiento.GASTO,
  })
  @IsEnum(TipoMovimiento, {
    message: 'El tipo debe ser INGRESO o GASTO',
  })
  tipo!: TipoMovimiento;
}
