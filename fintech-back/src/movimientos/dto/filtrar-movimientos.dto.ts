import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

import { TipoMovimiento } from '../../generated/prisma/enums';

export class FiltrarMovimientosDto {
  @ApiPropertyOptional({
    description: 'Filtra los movimientos por su tipo',
    enum: TipoMovimiento,
    enumName: 'TipoMovimiento',
    example: TipoMovimiento.GASTO,
  })
  @IsOptional()
  @IsEnum(TipoMovimiento, {
    message: 'El tipo debe ser INGRESO o GASTO',
  })
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({
    description: 'Filtra por el identificador de una categoría',
    example: 2,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'El identificador de la categoría debe ser entero',
  })
  @Min(1, {
    message: 'El identificador de la categoría no es válido',
  })
  categoriaId?: number;

  @ApiPropertyOptional({
    description: 'Fecha inicial del filtro en formato AAAA-MM-DD',
    example: '2026-08-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha inicial debe tener el formato AAAA-MM-DD',
  })
  @IsDateString(
    { strict: true },
    {
      message: 'La fecha inicial no es válida',
    },
  )
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del filtro en formato AAAA-MM-DD',
    example: '2026-08-08',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha final debe tener el formato AAAA-MM-DD',
  })
  @IsDateString(
    { strict: true },
    {
      message: 'La fecha final no es válida',
    },
  )
  fechaHasta?: string;
}
