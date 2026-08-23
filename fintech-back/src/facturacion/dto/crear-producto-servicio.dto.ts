import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const TARIFAS_IVA_PRODUCTO = ['CERO', 'QUINCE'] as const;
export type TarifaIvaProductoDto = (typeof TARIFAS_IVA_PRODUCTO)[number];

function limpiarTexto(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

export class CrearProductoServicioDto {
  @ApiProperty({ example: 'SERV-001' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'El código principal debe ser texto' })
  @IsNotEmpty({ message: 'El código principal es obligatorio' })
  @MaxLength(25, { message: 'El código principal admite máximo 25 caracteres' })
  codigoPrincipal!: string;

  @ApiProperty({ example: 'Asesoría financiera mensual' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La descripción debe ser texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(300, { message: 'La descripción admite máximo 300 caracteres' })
  descripcion!: string;

  @ApiProperty({
    description: 'Precio sin IVA expresado como texto decimal',
    example: '100.00',
  })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'El precio unitario debe enviarse como texto decimal' })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/, {
    message:
      'El precio unitario debe ser mayor o igual a cero y tener máximo seis decimales',
  })
  precioUnitario!: string;

  @ApiProperty({ enum: TARIFAS_IVA_PRODUCTO, example: 'QUINCE' })
  @IsIn(TARIFAS_IVA_PRODUCTO, { message: 'La tarifa de IVA no es válida' })
  tarifaIva!: TarifaIvaProductoDto;
}
