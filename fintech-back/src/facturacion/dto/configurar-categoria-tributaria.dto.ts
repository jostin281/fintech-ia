import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const TRATAMIENTOS_TRIBUTARIOS = [
  'INGRESO_GRAVADO',
  'INGRESO_EXENTO',
  'COSTO_GASTO_DEDUCIBLE',
  'GASTO_PERSONAL',
  'NO_DEDUCIBLE',
  'IGNORAR',
] as const;

export const CATEGORIAS_GASTO_PERSONAL = [
  'VIVIENDA',
  'ALIMENTACION',
  'SALUD',
  'EDUCACION_ARTE_CULTURA',
  'VESTIMENTA',
  'TURISMO',
] as const;

export class ConfigurarCategoriaTributariaDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La categoría debe identificarse con un número entero' })
  @Min(1, { message: 'El identificador de categoría debe ser mayor que cero' })
  categoriaId!: number;

  @ApiProperty({ enum: TRATAMIENTOS_TRIBUTARIOS })
  @IsIn(TRATAMIENTOS_TRIBUTARIOS, {
    message: 'El tratamiento tributario no es válido',
  })
  tratamiento!: (typeof TRATAMIENTOS_TRIBUTARIOS)[number];

  @ApiPropertyOptional({ enum: CATEGORIAS_GASTO_PERSONAL })
  @IsOptional()
  @IsIn(CATEGORIAS_GASTO_PERSONAL, {
    message: 'La categoría de gasto personal no es válida',
  })
  categoriaGastoPersonal?: (typeof CATEGORIAS_GASTO_PERSONAL)[number];
}
