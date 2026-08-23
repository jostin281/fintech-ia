import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { AlcanceRegla } from '../interfaces/alcance-regla.enum';

export class CrearReglaCategorizacionDto {
  @ApiProperty({
    description:
      'Palabra o fragmento que, si aparece en la descripción de una línea, dispara esta regla',
    example: 'gasolina',
    minLength: 2,
    maxLength: 150,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'La palabra clave debe ser texto' })
  @MinLength(2, { message: 'La palabra clave es demasiado corta' })
  @MaxLength(150, {
    message: 'La palabra clave no puede superar los 150 caracteres',
  })
  palabraClave!: string;

  @ApiProperty({
    description: 'Categoría GASTO que se asignará cuando la regla coincida',
    example: 4,
  })
  @Type(() => Number)
  @IsInt({ message: 'El identificador de la categoría debe ser entero' })
  @Min(1, { message: 'El identificador de la categoría no es válido' })
  categoriaId!: number;

  @ApiProperty({
    description:
      'GLOBAL crea una regla administrada visible para todos los usuarios (requiere rol ADMINISTRADOR); PERSONAL crea una regla propia del usuario autenticado',
    enum: AlcanceRegla,
    enumName: 'AlcanceRegla',
    example: AlcanceRegla.PERSONAL,
  })
  @IsEnum(AlcanceRegla, { message: 'El alcance debe ser GLOBAL o PERSONAL' })
  alcance!: AlcanceRegla;

  @ApiPropertyOptional({
    description:
      'Desempate cuando varias reglas del mismo alcance coinciden con la misma descripción (mayor gana)',
    example: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'La prioridad debe ser un número entero' })
  @Min(0, { message: 'La prioridad no puede ser negativa' })
  @Max(1000, { message: 'La prioridad no puede superar 1000' })
  prioridad?: number;

  @ApiPropertyOptional({
    description: 'Permite crear la regla ya desactivada',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'activa debe ser verdadero o falso' })
  activa?: boolean;
}
