import type { FormularioRdepCompleto } from '../rdep-validacion.service';

/**
 * Registro tal como lo devuelve Prisma para el modelo FormularioRdep (los
 * campos monetarios llegan como Prisma.Decimal, no como `number`).
 */
export interface FormularioRdepPrisma {
  periodoFiscal: number;
  tipoEmpleador: 'PRIVADO_MIXTO' | 'PUBLICO';
  enteSeguridadSocial: 'IESS' | 'ISSFA_ISSPOL';
  tipoIdentificacionTrabajador: 'CEDULA' | 'IDENTIFICACION_EXTERIOR' | 'PASAPORTE';
  numeroIdentificacionTrabajador: string;
  apellidosTrabajador: string;
  nombresTrabajador: string;
  codigoEstablecimiento: string;
  residenciaTrabajador: 'LOCAL' | 'EXTERIOR';
  paisResidenciaTrabajador: string;
  aplicaConvenioDobleImposicion: 'SI' | 'NO' | 'NO_APLICA';
  condicionDiscapacidad: 'NO_APLICA' | 'CON_DISCAPACIDAD' | 'SUSTITUTO';
  porcentajeDiscapacidad: number | null;
  beneficioGalapagos: boolean;
  cargasFamiliares: number;
  enfermedadCatastrofica: boolean;
  sistemaSalarioNeto: 'SIN_SISTEMA' | 'CON_SISTEMA';
  sueldosSalariosIngresosGravados: unknown;
  otrosIngresosGravados: unknown;
  participacionUtilidades: unknown;
  ingresosOtrosEmpleadores: unknown;
  decimoTercerSueldo: unknown;
  decimoCuartoSueldo: unknown;
  fondoReserva: unknown;
  otrosIngresosNoGravados: unknown;
  impuestoRentaAsumidoEmpleador: unknown;
  aportePersonalEsteEmpleador: unknown;
  aportePersonalOtrosEmpleadores: unknown;
  gastoVivienda: unknown;
  gastoSalud: unknown;
  gastoEducacion: unknown;
  gastoAlimentacion: unknown;
  gastoVestimenta: unknown;
  gastoTurismo: unknown;
  exoneracionDiscapacidad: unknown;
  exoneracionTerceraEdad: unknown;
  impuestoRetenidoAsumidoOtrosEmpleadores: unknown;
  impuestoAsumidoEsteEmpleador: unknown;
  canastaBasicaMensual: unknown;
}

/**
 * Convierte un registro de Prisma (con campos Decimal) al tipo plano
 * FormularioRdepCompleto (con `number`), usando Number(...) en vez de pasar
 * el objeto Decimal de Prisma directamente a decimal.js: Prisma empaqueta su
 * propia copia interna de decimal.js, distinta de la que usa este módulo
 * (rdep-calculo.ts), así que un `new Decimal(prismaValor)` directo podría
 * fallar. Number(prismaValor) sí funciona siempre porque usa la conversión
 * estándar (valueOf/toString) sin importar de qué clase sea el objeto.
 *
 * Es el único punto de conversión: lo usan por igual RdepService (validar),
 * RdepPdfService (vista previa/PDF) y AnexoRdepExcelService (anexo oficial),
 * así ninguno corre el riesgo de operar sobre un Decimal "crudo" de Prisma.
 */
export function mapearFormularioRdepCompleto(
  formulario: FormularioRdepPrisma,
): FormularioRdepCompleto {
  return {
    periodoFiscal: formulario.periodoFiscal,
    tipoEmpleador: formulario.tipoEmpleador,
    enteSeguridadSocial: formulario.enteSeguridadSocial,
    tipoIdentificacionTrabajador: formulario.tipoIdentificacionTrabajador,
    numeroIdentificacionTrabajador: formulario.numeroIdentificacionTrabajador,
    apellidosTrabajador: formulario.apellidosTrabajador,
    nombresTrabajador: formulario.nombresTrabajador,
    codigoEstablecimiento: formulario.codigoEstablecimiento,
    residenciaTrabajador: formulario.residenciaTrabajador,
    paisResidenciaTrabajador: formulario.paisResidenciaTrabajador,
    aplicaConvenioDobleImposicion: formulario.aplicaConvenioDobleImposicion,
    condicionDiscapacidad: formulario.condicionDiscapacidad,
    porcentajeDiscapacidad: formulario.porcentajeDiscapacidad,
    beneficioGalapagos: formulario.beneficioGalapagos,
    cargasFamiliares: formulario.cargasFamiliares,
    enfermedadCatastrofica: formulario.enfermedadCatastrofica,
    sistemaSalarioNeto: formulario.sistemaSalarioNeto,
    sueldosSalariosIngresosGravados: Number(
      formulario.sueldosSalariosIngresosGravados,
    ),
    otrosIngresosGravados: Number(formulario.otrosIngresosGravados),
    participacionUtilidades: Number(formulario.participacionUtilidades),
    ingresosOtrosEmpleadores: Number(formulario.ingresosOtrosEmpleadores),
    decimoTercerSueldo: Number(formulario.decimoTercerSueldo),
    decimoCuartoSueldo: Number(formulario.decimoCuartoSueldo),
    fondoReserva: Number(formulario.fondoReserva),
    otrosIngresosNoGravados: Number(formulario.otrosIngresosNoGravados),
    impuestoRentaAsumidoEmpleador: Number(
      formulario.impuestoRentaAsumidoEmpleador,
    ),
    aportePersonalEsteEmpleador: Number(formulario.aportePersonalEsteEmpleador),
    aportePersonalOtrosEmpleadores: Number(
      formulario.aportePersonalOtrosEmpleadores,
    ),
    gastoVivienda: Number(formulario.gastoVivienda),
    gastoSalud: Number(formulario.gastoSalud),
    gastoEducacion: Number(formulario.gastoEducacion),
    gastoAlimentacion: Number(formulario.gastoAlimentacion),
    gastoVestimenta: Number(formulario.gastoVestimenta),
    gastoTurismo: Number(formulario.gastoTurismo),
    exoneracionDiscapacidad: Number(formulario.exoneracionDiscapacidad),
    exoneracionTerceraEdad: Number(formulario.exoneracionTerceraEdad),
    impuestoRetenidoAsumidoOtrosEmpleadores: Number(
      formulario.impuestoRetenidoAsumidoOtrosEmpleadores,
    ),
    impuestoAsumidoEsteEmpleador: Number(
      formulario.impuestoAsumidoEsteEmpleador,
    ),
    canastaBasicaMensual: Number(formulario.canastaBasicaMensual),
  };
}
