import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { EstadoComprobanteRecibido } from '../../generated/prisma/enums';

export class FiltrarComprobantesRecibidosDto {
  @ApiPropertyOptional({
    description: 'Filtra por el estado del comprobante',
    enum: EstadoComprobanteRecibido,
    enumName: 'EstadoComprobanteRecibido',
    example: EstadoComprobanteRecibido.PROCESADO,
  })
  @IsOptional()
  @IsEnum(EstadoComprobanteRecibido, {
    message: 'El estado no es válido',
  })
  estado?: EstadoComprobanteRecibido;

  @ApiPropertyOptional({
    description: 'Filtra por el identificador de un proveedor',
    example: 3,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El identificador del proveedor debe ser entero' })
  @Min(1, { message: 'El identificador del proveedor no es válido' })
  proveedorId?: number;

  @ApiPropertyOptional({
    description:
      'Filtra por comprobantes que tengan al menos una línea en esta categoría',
    example: 2,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El identificador de la categoría debe ser entero' })
  @Min(1, { message: 'El identificador de la categoría no es válido' })
  categoriaId?: number;

  @ApiPropertyOptional({
    description: 'Fecha inicial del filtro en formato AAAA-MM-DD',
    example: '2026-08-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha inicial debe tener el formato AAAA-MM-DD',
  })
  @IsDateString({ strict: true }, { message: 'La fecha inicial no es válida' })
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del filtro en formato AAAA-MM-DD',
    example: '2026-08-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha final debe tener el formato AAAA-MM-DD',
  })
  @IsDateString({ strict: true }, { message: 'La fecha final no es válida' })
  fechaHasta?: string;

  @ApiPropertyOptional({
    description:
      'Búsqueda libre por razón social del proveedor o número de factura',
    example: 'Supermercado',
  })
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @MaxLength(150, { message: 'La búsqueda no puede superar 150 caracteres' })
  q?: string;
}
