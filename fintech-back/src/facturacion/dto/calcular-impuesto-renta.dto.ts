import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CalcularImpuestoRentaDto {
  @ApiPropertyOptional({
    description: 'Ingresos gravados no incluidos en las facturas del módulo',
    example: 12000,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'otrosIngresosGravados no es válido' },
  )
  @Min(0)
  otrosIngresosGravados?: number;

  @ApiPropertyOptional({
    description: 'Aportes personales al IESS',
    example: 1134,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'aporteIess no es válido' })
  @Min(0)
  aporteIess?: number;

  @ApiPropertyOptional({
    description: 'Otras deducciones legalmente respaldadas',
    example: 500,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'otrasDeducciones no es válido' },
  )
  @Min(0)
  otrasDeducciones?: number;

  @ApiPropertyOptional({
    description: 'Número de cargas familiares válidas para el ejercicio fiscal',
    example: 1,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El número de cargas familiares debe ser entero' })
  @Min(0)
  @Max(99)
  cargasFamiliares?: number;

  @ApiPropertyOptional({
    description:
      'Indica si aplica el límite especial por enfermedad catastrófica, rara o huérfana',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'enfermedadCatastrofica debe ser verdadero o falso' })
  enfermedadCatastrofica?: boolean;

  @ApiPropertyOptional({
    description:
      'Canasta básica familiar mensual usada para proyectar la rebaja. Para el cierre anual corresponde la de diciembre',
    example: 815.75,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'canastaBasicaMensual no es válida' },
  )
  @Min(0.01)
  canastaBasicaMensual?: number;

  @ApiPropertyOptional({
    description: 'Créditos tributarios adicionales distintos de retenciones',
    example: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'otrosCreditosTributarios no es válido' },
  )
  @Min(0)
  otrosCreditosTributarios?: number;
}
