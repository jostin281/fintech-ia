// ApiProperty y ApiPropertyOptional documentan los campos en Swagger.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Estos decoradores permiten establecer reglas de validación.
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Este DTO define qué información debe enviar el usuario
// para registrar un movimiento financiero de prueba.
export class CrearMovimientoPruebaDto {
  // El tipo solamente puede ser INGRESO o GASTO.
  @ApiProperty({
    description: 'Tipo de movimiento financiero',
    example: 'GASTO',
    enum: ['INGRESO', 'GASTO'],
  })
  @IsString({
    message: 'El tipo debe ser un texto',
  })
  @IsIn(['INGRESO', 'GASTO'], {
    message: 'El tipo solamente puede ser INGRESO o GASTO',
  })
  tipo!: string;

  // El monto debe ser un número positivo con máximo dos decimales.
  @ApiProperty({
    description: 'Valor monetario del movimiento',
    example: 25.5,
    minimum: 0.01,
  })
  @IsNumber(
    {
      maxDecimalPlaces: 2,
    },
    {
      message: 'El monto debe ser un número con máximo dos decimales',
    },
  )
  @Min(0.01, {
    message: 'El monto debe ser mayor que cero',
  })
  monto!: number;

  // La descripción es opcional.
  @ApiPropertyOptional({
    description: 'Detalle del movimiento',
    example: 'Compra de alimentos',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({
    message: 'La descripción debe ser un texto',
  })
  @MaxLength(200, {
    message: 'La descripción no puede superar los 200 caracteres',
  })
  descripcion?: string;

  // La fecha debe utilizar un formato válido, como AAAA-MM-DD.
  @ApiProperty({
    description: 'Fecha en la que se realizó el movimiento',
    example: '2026-08-05',
  })
  @IsDateString(
    {},
    {
      message: 'La fecha debe tener un formato válido, por ejemplo 2026-08-05',
    },
  )
  fecha!: string;

  // El identificador de la categoría debe ser un número entero positivo.
  @ApiProperty({
    description: 'Identificador de la categoría',
    example: 1,
    minimum: 1,
  })
  @IsInt({
    message: 'El identificador de la categoría debe ser un número entero',
  })
  @Min(1, {
    message: 'El identificador de la categoría debe ser mayor que cero',
  })
  categoriaId!: number;
}
