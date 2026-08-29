import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const TIPOS_IDENTIFICACION_SRI = [
  'RUC',
  'CEDULA',
  'PASAPORTE',
  'CONSUMIDOR_FINAL',
  'IDENTIFICACION_EXTERIOR',
] as const;

export type TipoIdentificacionSriDto =
  (typeof TIPOS_IDENTIFICACION_SRI)[number];

function limpiarTexto(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

function limpiarTextoOpcional(valor: unknown): unknown {
  if (typeof valor !== 'string') {
    return valor;
  }

  const texto = valor.trim();
  return texto.length === 0 ? undefined : texto;
}

export class CrearClienteDto {
  @ApiProperty({ enum: TIPOS_IDENTIFICACION_SRI, example: 'CEDULA' })
  @IsIn(TIPOS_IDENTIFICACION_SRI, {
    message: 'El tipo de identificación no es válido',
  })
  tipoIdentificacion!: TipoIdentificacionSriDto;

  @ApiProperty({ example: '1755555552' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La identificación debe ser texto' })
  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @MaxLength(20, { message: 'La identificación admite máximo 20 caracteres' })
  identificacion!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La razón social debe ser texto' })
  @IsNotEmpty({ message: 'La razón social o nombre es obligatorio' })
  @MaxLength(300, { message: 'La razón social admite máximo 300 caracteres' })
  razonSocial!: string;

  @ApiPropertyOptional({ example: 'Ana Pérez Consultora' })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsString({ message: 'El nombre comercial debe ser texto' })
  @MaxLength(300, {
    message: 'El nombre comercial admite máximo 300 caracteres',
  })
  nombreComercial?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(150, { message: 'El correo admite máximo 150 caracteres' })
  correo?: string;

  @ApiPropertyOptional({ example: 'Av. 6 de Diciembre, Quito' })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  @MaxLength(300, { message: 'La dirección admite máximo 300 caracteres' })
  direccion?: string;

  @ApiPropertyOptional({ example: '0999999999' })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(30, { message: 'El teléfono admite máximo 30 caracteres' })
  telefono?: string;
}
