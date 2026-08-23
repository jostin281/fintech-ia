import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const TIPOS_CONTRIBUYENTE = ['PERSONA_NATURAL', 'SOCIEDAD'] as const;

export const REGIMENES_TRIBUTARIOS = [
  'GENERAL',
  'RIMPE_NEGOCIO_POPULAR',
  'RIMPE_EMPRENDEDOR',
] as const;

export const TIPOS_IDENTIFICACION_PERFIL = ['RUC', 'CEDULA'] as const;

export type TipoContribuyenteDto = (typeof TIPOS_CONTRIBUYENTE)[number];
export type RegimenTributarioDto = (typeof REGIMENES_TRIBUTARIOS)[number];
export type TipoIdentificacionPerfilDto =
  (typeof TIPOS_IDENTIFICACION_PERFIL)[number];

/**
 * Valida el campo "ruc" según el tipo de identificación elegido: diez
 * dígitos si es una cédula, trece si es un RUC completo. Si no se envía
 * tipoIdentificacion (por compatibilidad con llamadas anteriores) se asume
 * RUC, igual que el comportamiento previo a este selector.
 */
@ValidatorConstraint({ name: 'esIdentificacionPerfilValida', async: false })
class EsIdentificacionPerfilValidaConstraint
  implements ValidatorConstraintInterface
{
  validate(valor: unknown, args: ValidationArguments): boolean {
    if (typeof valor !== 'string') {
      return false;
    }

    const objeto = args.object as { tipoIdentificacion?: string };
    const esCedula = objeto.tipoIdentificacion === 'CEDULA';

    return esCedula ? /^\d{10}$/.test(valor) : /^\d{13}$/.test(valor);
  }

  defaultMessage(args: ValidationArguments): string {
    const objeto = args.object as { tipoIdentificacion?: string };

    return objeto.tipoIdentificacion === 'CEDULA'
      ? 'La cédula debe contener exactamente diez dígitos'
      : 'El RUC debe contener exactamente trece dígitos';
  }
}

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

function transformarBooleano(valor: unknown): unknown {
  if (valor === 'true') {
    return true;
  }

  if (valor === 'false') {
    return false;
  }

  return valor;
}

export class CrearPerfilTributarioDto {
  @ApiPropertyOptional({
    description:
      'Tipo de identificación ingresada en "ruc": RUC completo (13 dígitos) o cédula (10 dígitos). Si se elige CEDULA, el sistema completa automáticamente el RUC de persona natural agregando el establecimiento "001", como exige el SRI. Si no se envía, se asume RUC.',
    enum: TIPOS_IDENTIFICACION_PERFIL,
    default: 'RUC',
  })
  @IsOptional()
  @IsIn(TIPOS_IDENTIFICACION_PERFIL, {
    message: 'El tipo de identificación no es válido',
  })
  tipoIdentificacion?: TipoIdentificacionPerfilDto;

  @ApiProperty({
    description:
      'Número de identificación del emisor: RUC de trece dígitos, o cédula de diez dígitos si tipoIdentificacion es CEDULA',
    example: '1799999990001',
  })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La identificación debe ser texto' })
  @Validate(EsIdentificacionPerfilValidaConstraint)
  ruc!: string;

  @ApiProperty({
    description: 'Nombre legal registrado en el RUC',
    example: 'SERVICIOS FINANCIEROS EJEMPLO S.A.',
  })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La razón social debe ser texto' })
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  @MaxLength(300, { message: 'La razón social admite máximo 300 caracteres' })
  razonSocial!: string;

  @ApiPropertyOptional({
    description: 'Nombre comercial del contribuyente',
    example: 'Fintech Ejemplo',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @IsString({ message: 'El nombre comercial debe ser texto' })
  @MaxLength(300, {
    message: 'El nombre comercial admite máximo 300 caracteres',
  })
  nombreComercial?: string;

  @ApiProperty({
    description: 'Dirección matriz registrada para el emisor',
    example: 'Av. Amazonas N34-123, Quito',
  })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString({ message: 'La dirección matriz debe ser texto' })
  @IsNotEmpty({ message: 'La dirección matriz es obligatoria' })
  @MaxLength(300, {
    message: 'La dirección matriz admite máximo 300 caracteres',
  })
  direccionMatriz!: string;

  @ApiProperty({
    enum: TIPOS_CONTRIBUYENTE,
    example: 'PERSONA_NATURAL',
  })
  @IsIn(TIPOS_CONTRIBUYENTE, {
    message: 'El tipo de contribuyente no es válido',
  })
  tipoContribuyente!: TipoContribuyenteDto;

  @ApiProperty({
    enum: REGIMENES_TRIBUTARIOS,
    example: 'GENERAL',
  })
  @IsIn(REGIMENES_TRIBUTARIOS, {
    message: 'El régimen tributario no es válido',
  })
  regimenTributario!: RegimenTributarioDto;

  @ApiPropertyOptional({
    description:
      'Indica si el contribuyente está obligado a llevar contabilidad',
    default: false,
  })
  @Transform(({ value }) => transformarBooleano(value))
  @IsOptional()
  @IsBoolean({ message: 'obligadoContabilidad debe ser verdadero o falso' })
  obligadoContabilidad?: boolean;

  @ApiPropertyOptional({
    description: 'Código de resolución de contribuyente especial',
    example: '1234',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @Matches(/^\d{1,20}$/, {
    message: 'El código de contribuyente especial solo admite números',
  })
  codigoContribuyenteEspecial?: string;

  @ApiPropertyOptional({
    description: 'Código de resolución como agente de retención',
    example: '1',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @Matches(/^\d{1,20}$/, {
    message: 'El código de agente de retención solo admite números',
  })
  codigoAgenteRetencion?: string;

  @ApiPropertyOptional({
    description: 'Código de establecimiento de tres dígitos',
    default: '001',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @Length(3, 3, { message: 'El establecimiento debe tener tres dígitos' })
  @Matches(/^\d{3}$/, { message: 'El establecimiento solo admite números' })
  establecimiento?: string;

  @ApiPropertyOptional({
    description: 'Código de punto de emisión de tres dígitos',
    default: '001',
  })
  @Transform(({ value }) => limpiarTextoOpcional(value))
  @IsOptional()
  @Length(3, 3, { message: 'El punto de emisión debe tener tres dígitos' })
  @Matches(/^\d{3}$/, { message: 'El punto de emisión solo admite números' })
  puntoEmision?: string;

  @ApiPropertyOptional({
    description:
      'Ambiente del SRI para este perfil. PRUEBAS (recomendado para desarrollo) o PRODUCCION (facturas reales). Por defecto PRUEBAS.',
    enum: ['PRUEBAS', 'PRODUCCION'],
    default: 'PRUEBAS',
  })
  @IsOptional()
  @IsIn(['PRUEBAS', 'PRODUCCION'], {
    message: 'El ambiente del SRI debe ser PRUEBAS o PRODUCCION',
  })
  ambienteSri?: 'PRUEBAS' | 'PRODUCCION';
}
