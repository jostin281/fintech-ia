import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TIPOS_IDENTIFICACION_TRABAJADOR_RDEP = [
  'CEDULA',
  'IDENTIFICACION_EXTERIOR',
  'PASAPORTE',
] as const;
export const RESIDENCIAS_TRABAJADOR_RDEP = ['LOCAL', 'EXTERIOR'] as const;
export const CONDICIONES_DISCAPACIDAD_RDEP = [
  'NO_APLICA',
  'CON_DISCAPACIDAD',
  'SUSTITUTO',
] as const;
export const CONVENIOS_DOBLE_IMPOSICION_RDEP = [
  'SI',
  'NO',
  'NO_APLICA',
] as const;
export const SISTEMAS_SALARIO_NETO_RDEP = [
  'SIN_SISTEMA',
  'CON_SISTEMA',
] as const;
export const TIPOS_EMPLEADOR_RDEP = ['PRIVADO_MIXTO', 'PUBLICO'] as const;
export const ENTES_SEGURIDAD_SOCIAL_RDEP = ['IESS', 'ISSFA_ISSPOL'] as const;

export type TipoIdentificacionTrabajadorRdepDto =
  (typeof TIPOS_IDENTIFICACION_TRABAJADOR_RDEP)[number];
export type ResidenciaTrabajadorRdepDto =
  (typeof RESIDENCIAS_TRABAJADOR_RDEP)[number];
export type CondicionDiscapacidadRdepDto =
  (typeof CONDICIONES_DISCAPACIDAD_RDEP)[number];
export type ConvenioDobleImposicionRdepDto =
  (typeof CONVENIOS_DOBLE_IMPOSICION_RDEP)[number];
export type SistemaSalarioNetoRdepDto =
  (typeof SISTEMAS_SALARIO_NETO_RDEP)[number];
export type TipoEmpleadorRdepDto = (typeof TIPOS_EMPLEADOR_RDEP)[number];
export type EnteSeguridadSocialRdepDto =
  (typeof ENTES_SEGURIDAD_SOCIAL_RDEP)[number];

function limpiarTexto(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

export class CrearFormularioRdepDto {
  @ApiProperty({
    description:
      'Año del período fiscal declarado. El Anexo RDEP admite períodos desde 2006 en adelante.',
    example: 2025,
  })
  @Type(() => Number)
  @IsInt({ message: 'El período fiscal debe ser un año entero' })
  @Min(2006, { message: 'El Anexo RDEP solo admite períodos desde 2006' })
  periodoFiscal!: number;

  @ApiProperty({ enum: TIPOS_EMPLEADOR_RDEP, example: 'PRIVADO_MIXTO' })
  @IsIn(TIPOS_EMPLEADOR_RDEP, { message: 'El tipo de empleador no es válido' })
  tipoEmpleador!: TipoEmpleadorRdepDto;

  @ApiProperty({ enum: ENTES_SEGURIDAD_SOCIAL_RDEP, example: 'IESS' })
  @IsIn(ENTES_SEGURIDAD_SOCIAL_RDEP, {
    message: 'El ente de seguridad social no es válido',
  })
  enteSeguridadSocial!: EnteSeguridadSocialRdepDto;

  // ----- Identificación del trabajador -----

  @ApiProperty({
    enum: TIPOS_IDENTIFICACION_TRABAJADOR_RDEP,
    example: 'CEDULA',
  })
  @IsIn(TIPOS_IDENTIFICACION_TRABAJADOR_RDEP, {
    message: 'El tipo de identificación del trabajador no es válido',
  })
  tipoIdentificacionTrabajador!: TipoIdentificacionTrabajadorRdepDto;

  @ApiProperty({ example: '1792004123' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString()
  @Matches(/^[A-Za-z0-9]{3,13}$/, {
    message:
      'La identificación del trabajador solo admite letras y números (3 a 13 caracteres)',
  })
  numeroIdentificacionTrabajador!: string;

  @ApiProperty({ example: 'Pérez García' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString()
  @MinLength(2, { message: 'Los apellidos deben tener al menos 2 caracteres' })
  @MaxLength(100)
  apellidosTrabajador!: string;

  @ApiProperty({ example: 'Juan Carlos' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsString()
  @MinLength(2, { message: 'Los nombres deben tener al menos 2 caracteres' })
  @MaxLength(100)
  nombresTrabajador!: string;

  @ApiPropertyOptional({ default: '001', example: '001' })
  @Transform(({ value }) => limpiarTexto(value))
  @IsOptional()
  @Length(3, 3, {
    message: 'El código de establecimiento debe tener 3 dígitos',
  })
  @Matches(/^\d{3}$/, {
    message: 'El código de establecimiento solo admite números',
  })
  codigoEstablecimiento?: string;

  @ApiPropertyOptional({ enum: RESIDENCIAS_TRABAJADOR_RDEP, default: 'LOCAL' })
  @IsOptional()
  @IsIn(RESIDENCIAS_TRABAJADOR_RDEP, {
    message: 'La residencia del trabajador no es válida',
  })
  residenciaTrabajador?: ResidenciaTrabajadorRdepDto;

  @ApiPropertyOptional({
    description: 'Código de país (catálogo SRI), 3 dígitos. 593 = Ecuador.',
    default: '593',
  })
  @Transform(({ value }) => limpiarTexto(value))
  @IsOptional()
  @Matches(/^\d{1,3}$/, {
    message: 'El código de país debe ser numérico (hasta 3 dígitos)',
  })
  paisResidenciaTrabajador?: string;

  @ApiPropertyOptional({
    enum: CONVENIOS_DOBLE_IMPOSICION_RDEP,
    default: 'NO_APLICA',
  })
  @IsOptional()
  @IsIn(CONVENIOS_DOBLE_IMPOSICION_RDEP, {
    message: 'El valor de convenio de doble imposición no es válido',
  })
  aplicaConvenioDobleImposicion?: ConvenioDobleImposicionRdepDto;

  @ApiPropertyOptional({
    enum: CONDICIONES_DISCAPACIDAD_RDEP,
    default: 'NO_APLICA',
  })
  @IsOptional()
  @IsIn(CONDICIONES_DISCAPACIDAD_RDEP, {
    message: 'La condición de discapacidad no es válida',
  })
  condicionDiscapacidad?: CondicionDiscapacidadRdepDto;

  @ApiPropertyOptional({
    description:
      'Obligatorio solo si condicionDiscapacidad es distinto de NO_APLICA',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  porcentajeDiscapacidad?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  beneficioGalapagos?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enfermedadCatastrofica?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  cargasFamiliares?: number;

  // ----- Ingresos (301-317) -----

  @ApiPropertyOptional({ description: 'Casillero 301', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sueldosSalariosIngresosGravados?: number;

  @ApiPropertyOptional({ description: 'Casillero 303', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otrosIngresosGravados?: number;

  @ApiPropertyOptional({ description: 'Casillero 305', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  participacionUtilidades?: number;

  @ApiPropertyOptional({ description: 'Casillero 307', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ingresosOtrosEmpleadores?: number;

  @ApiPropertyOptional({ description: 'Casillero 311 (exento)', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  decimoTercerSueldo?: number;

  @ApiPropertyOptional({ description: 'Casillero 313 (exento)', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  decimoCuartoSueldo?: number;

  @ApiPropertyOptional({ description: 'Casillero 315 (exento)', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fondoReserva?: number;

  @ApiPropertyOptional({ description: 'Casillero 317 (exento)', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otrosIngresosNoGravados?: number;

  @ApiPropertyOptional({ description: 'Casillero 381', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impuestoRentaAsumidoEmpleador?: number;

  // ----- Deducciones (351-373) -----

  @ApiPropertyOptional({
    enum: SISTEMAS_SALARIO_NETO_RDEP,
    default: 'SIN_SISTEMA',
  })
  @IsOptional()
  @IsIn(SISTEMAS_SALARIO_NETO_RDEP, {
    message: 'El sistema de salario neto no es válido',
  })
  sistemaSalarioNeto?: SistemaSalarioNetoRdepDto;

  @ApiPropertyOptional({ description: 'Casillero 351', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  aportePersonalEsteEmpleador?: number;

  @ApiPropertyOptional({ description: 'Casillero 353', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  aportePersonalOtrosEmpleadores?: number;

  @ApiPropertyOptional({ description: 'Casillero 361 · Vivienda', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoVivienda?: number;

  @ApiPropertyOptional({ description: 'Casillero 363 · Salud', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoSalud?: number;

  @ApiPropertyOptional({
    description: 'Casillero 365 · Educación, arte y cultura',
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoEducacion?: number;

  @ApiPropertyOptional({
    description: 'Casillero 367 · Alimentación',
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoAlimentacion?: number;

  @ApiPropertyOptional({
    description: 'Casillero 369 · Vestimenta',
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoVestimenta?: number;

  @ApiPropertyOptional({ description: 'Casillero 362 · Turismo', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastoTurismo?: number;

  @ApiPropertyOptional({ description: 'Casillero 371', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  exoneracionDiscapacidad?: number;

  @ApiPropertyOptional({ description: 'Casillero 373', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  exoneracionTerceraEdad?: number;

  @ApiPropertyOptional({ description: 'Casillero 404', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impuestoRetenidoAsumidoOtrosEmpleadores?: number;

  @ApiPropertyOptional({ description: 'Casillero 405', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impuestoAsumidoEsteEmpleador?: number;

  @ApiProperty({
    description:
      'Canasta Familiar Básica de diciembre del INEC, usada para calcular la rebaja por gastos personales de este período.',
    example: 789.57,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, {
    message: 'Debe indicar la Canasta Familiar Básica vigente del período',
  })
  canastaBasicaMensual!: number;
}

/**
 * Igual que CrearFormularioRdepDto pero con TODOS los campos opcionales
 * (permite editar solo algunos campos de un borrador), usando el mismo
 * patrón PartialType que ya usa el resto del backend (ver
 * actualizar-perfil-tributario.dto.ts): conserva automáticamente todos los
 * decoradores de validación de cada campo, solo agrega @IsOptional().
 */
export class ActualizarFormularioRdepDto extends PartialType(
  CrearFormularioRdepDto,
) {}
