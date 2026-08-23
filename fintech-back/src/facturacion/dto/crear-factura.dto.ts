import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CrearDetalleFacturaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'El producto debe identificarse con un número entero' })
  @Min(1, { message: 'El identificador del producto debe ser mayor que cero' })
  productoServicioId!: number;

  @ApiProperty({
    description: 'Cantidad expresada como texto decimal',
    example: '2.00',
  })
  @IsString({ message: 'La cantidad debe enviarse como texto decimal' })
  @Matches(/^(?:0\.(?=\d{1,6}$)(?!0+$)\d{1,6}|[1-9]\d{0,7}(?:\.\d{1,6})?)$/, {
    message:
      'La cantidad debe ser mayor que cero y tener máximo seis decimales',
  })
  cantidad!: string;

  @ApiPropertyOptional({
    description: 'Descuento monetario de la línea, no porcentaje',
    example: '5.00',
    default: '0.00',
  })
  @IsOptional()
  @IsString({ message: 'El descuento debe enviarse como texto decimal' })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, {
    message: 'El descuento debe ser positivo y tener máximo dos decimales',
  })
  descuento?: string;
}

export class CrearFacturaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'El cliente debe identificarse con un número entero' })
  @Min(1, { message: 'El identificador del cliente debe ser mayor que cero' })
  clienteId!: number;

  @ApiPropertyOptional({
    description: 'Fecha de emisión en formato YYYY-MM-DD; por defecto hoy',
    example: '2026-08-13',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'La fecha de emisión debe usar el formato YYYY-MM-DD' },
  )
  fechaEmision?: string;

  @ApiPropertyOptional({
    description: 'Código SRI de forma de pago',
    example: '20',
    default: '20',
  })
  @IsOptional()
  @Matches(/^(01|15|16|17|18|19|20|21)$/, {
    message: 'La forma de pago no pertenece al catálogo permitido del SRI',
  })
  formaPago?: string;

  @ApiPropertyOptional({ example: 'Pago mediante transferencia bancaria' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser texto' })
  @MaxLength(300, { message: 'La observación admite máximo 300 caracteres' })
  observacion?: string;

  @ApiProperty({ type: [CrearDetalleFacturaDto] })
  @IsArray({ message: 'Los detalles deben enviarse como una lista' })
  @ArrayMinSize(1, { message: 'La factura debe contener al menos un detalle' })
  @ArrayMaxSize(100, { message: 'Una factura admite máximo 100 detalles' })
  @ValidateNested({ each: true })
  @Type(() => CrearDetalleFacturaDto)
  detalles!: CrearDetalleFacturaDto[];
}
