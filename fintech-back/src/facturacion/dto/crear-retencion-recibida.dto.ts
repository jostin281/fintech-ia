import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearRetencionRecibidaDto {
  @ApiProperty({ enum: ['RENTA', 'IVA'], example: 'RENTA' })
  @IsIn(['RENTA', 'IVA'] as const, {
    message: 'El tipo de retención no es válido',
  })
  tipo!: 'RENTA' | 'IVA';

  @ApiProperty({
    description:
      'RUC, cédula o identificación del cliente que emitió la retención',
    example: '1799999990001',
  })
  @Matches(/^[A-Za-z0-9._-]{3,20}$/, {
    message:
      'La identificación del emisor debe contener entre 3 y 20 caracteres',
  })
  emisorIdentificacion!: string;

  @ApiProperty({ example: '001-001-000000123' })
  @IsString({ message: 'El número de comprobante debe ser texto' })
  @MaxLength(50, {
    message: 'El número de comprobante admite máximo 50 caracteres',
  })
  numeroComprobante!: string;

  @ApiProperty({ example: '2026-08-13' })
  @IsDateString(
    { strict: true },
    { message: 'La fecha de emisión debe usar el formato YYYY-MM-DD' },
  )
  fechaEmision!: string;

  @ApiProperty({ example: '100.00' })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, {
    message: 'La base imponible debe tener máximo dos decimales',
  })
  baseImponible!: string;

  @ApiProperty({ example: '2.75' })
  @Matches(/^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/, {
    message: 'El porcentaje debe tener máximo cuatro decimales',
  })
  porcentaje!: string;

  @ApiProperty({ example: '2.75' })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, {
    message: 'El valor retenido debe tener máximo dos decimales',
  })
  valor!: string;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'La factura debe identificarse con un número entero' })
  @Min(1)
  facturaId?: number;

  @ApiPropertyOptional({ example: 'Retención entregada por el cliente' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser texto' })
  @MaxLength(300, { message: 'La observación admite máximo 300 caracteres' })
  observacion?: string;
}
