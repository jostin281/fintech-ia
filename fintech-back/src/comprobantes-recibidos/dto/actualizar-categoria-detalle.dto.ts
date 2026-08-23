import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ActualizarCategoriaDetalleDto {
  @ApiProperty({
    description: 'Nueva categoría GASTO para esta línea del comprobante',
    example: 3,
  })
  @Type(() => Number)
  @IsInt({ message: 'El identificador de la categoría debe ser entero' })
  @Min(1, { message: 'El identificador de la categoría no es válido' })
  categoriaId!: number;

  @ApiPropertyOptional({
    description:
      'Si es verdadero, además crea (o reutiliza) una regla personal con la palabra clave indicada para clasificar automáticamente futuras líneas parecidas',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'crearRegla debe ser verdadero o falso' })
  crearRegla?: boolean;

  @ApiPropertyOptional({
    description:
      'Palabra clave para la regla personal a crear (obligatoria si crearRegla es verdadero)',
    example: 'arroz',
    minLength: 2,
    maxLength: 150,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @ValidateIf((dto: ActualizarCategoriaDetalleDto) => dto.crearRegla === true)
  @IsString({ message: 'La palabra clave debe ser texto' })
  @MinLength(2, { message: 'La palabra clave es demasiado corta' })
  @MaxLength(150, {
    message: 'La palabra clave no puede superar los 150 caracteres',
  })
  palabraClave?: string;
}
