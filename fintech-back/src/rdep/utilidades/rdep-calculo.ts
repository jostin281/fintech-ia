import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

import {
  calcularImpuestoPersonaNaturalGeneral,
  calcularRebajaGastosPersonales,
} from '../../facturacion/utilidades/calculadora-impuesto-renta';

/**
 * Subconjunto de campos de FormularioRdep que participan en el cálculo del
 * resumen impositivo (casilleros 399, 401, 402, 403 y 407). Se define un
 * tipo propio (en vez de reutilizar el modelo de Prisma) para que este
 * módulo se pueda probar sin depender de Prisma.
 */
export interface DatosCalculoRdep {
  periodoFiscal: number;
  sueldosSalariosIngresosGravados: Decimal.Value;
  otrosIngresosGravados: Decimal.Value;
  participacionUtilidades: Decimal.Value;
  ingresosOtrosEmpleadores: Decimal.Value;
  impuestoRentaAsumidoEmpleador: Decimal.Value;
  aportePersonalEsteEmpleador: Decimal.Value;
  aportePersonalOtrosEmpleadores: Decimal.Value;
  gastoVivienda: Decimal.Value;
  gastoSalud: Decimal.Value;
  gastoEducacion: Decimal.Value;
  gastoAlimentacion: Decimal.Value;
  gastoVestimenta: Decimal.Value;
  gastoTurismo: Decimal.Value;
  exoneracionDiscapacidad: Decimal.Value;
  exoneracionTerceraEdad: Decimal.Value;
  impuestoRetenidoAsumidoOtrosEmpleadores: Decimal.Value;
  impuestoAsumidoEsteEmpleador: Decimal.Value;
  canastaBasicaMensual: Decimal.Value;
  cargasFamiliares: number;
  enfermedadCatastrofica: boolean;
}

export interface ResultadoCalculoRdep {
  ingresosGravados: string;
  totalGastosPersonales: string;
  baseImponibleGravada: string;
  impuestoRentaCausado: string;
  numeroCanastasAplicadas: number;
  limiteGastosPersonalesReconocido: string;
  rebajaGastosPersonales: string;
  impuestoRentaCausadoDespuesRebaja: string;
  impuestoRetenidoTrabajadorEsteEmpleador: string;
}

/**
 * Recalcula siempre en el backend los casilleros 399/401/402/403/407 a
 * partir de los datos capturados. Estos 5 valores NUNCA se aceptan como
 * entrada del cliente (ver CrearFormularioRdepDto): así se evita que la
 * aplicación guarde un formulario con un resultado inconsistente con sus
 * propios datos de origen.
 */
export function calcularResumenImpositivoRdep(
  datos: DatosCalculoRdep,
): ResultadoCalculoRdep {
  const ingresosGravados = new Decimal(datos.sueldosSalariosIngresosGravados)
    .plus(datos.otrosIngresosGravados)
    .plus(datos.participacionUtilidades)
    .plus(datos.ingresosOtrosEmpleadores)
    .plus(datos.impuestoRentaAsumidoEmpleador);

  const aportesPersonales = new Decimal(
    datos.aportePersonalEsteEmpleador,
  ).plus(datos.aportePersonalOtrosEmpleadores);

  const exoneraciones = new Decimal(datos.exoneracionDiscapacidad).plus(
    datos.exoneracionTerceraEdad,
  );

  const baseImponibleGravada = Decimal.max(
    ingresosGravados.minus(aportesPersonales).minus(exoneraciones),
    0,
  );

  const calculoTabla = calcularImpuestoPersonaNaturalGeneral(
    datos.periodoFiscal,
    baseImponibleGravada,
  );
  const impuestoRentaCausado = new Decimal(calculoTabla.impuestoCausado);

  const totalGastosPersonales = new Decimal(datos.gastoVivienda)
    .plus(datos.gastoSalud)
    .plus(datos.gastoEducacion)
    .plus(datos.gastoAlimentacion)
    .plus(datos.gastoVestimenta)
    .plus(datos.gastoTurismo);

  const detalleRebaja = calcularRebajaGastosPersonales(
    totalGastosPersonales,
    datos.canastaBasicaMensual,
    datos.cargasFamiliares,
    datos.enfermedadCatastrofica,
  );

  // La rebaja nunca puede superar el impuesto causado (no genera saldo
  // negativo de impuesto).
  const rebajaGastosPersonales = Decimal.min(
    new Decimal(detalleRebaja.rebaja),
    impuestoRentaCausado,
  );

  const impuestoRentaCausadoDespuesRebaja = Decimal.max(
    impuestoRentaCausado.minus(rebajaGastosPersonales),
    0,
  );

  const impuestoRetenidoTrabajadorEsteEmpleador = Decimal.max(
    impuestoRentaCausadoDespuesRebaja
      .minus(datos.impuestoRetenidoAsumidoOtrosEmpleadores)
      .minus(datos.impuestoAsumidoEsteEmpleador),
    0,
  );

  return {
    ingresosGravados: ingresosGravados.toFixed(2),
    totalGastosPersonales: totalGastosPersonales.toFixed(2),
    baseImponibleGravada: baseImponibleGravada.toFixed(2),
    impuestoRentaCausado: impuestoRentaCausado.toFixed(2),
    numeroCanastasAplicadas: detalleRebaja.numeroCanastas,
    limiteGastosPersonalesReconocido: detalleRebaja.limiteGastosPersonales,
    rebajaGastosPersonales: rebajaGastosPersonales.toFixed(2),
    impuestoRentaCausadoDespuesRebaja:
      impuestoRentaCausadoDespuesRebaja.toFixed(2),
    impuestoRetenidoTrabajadorEsteEmpleador:
      impuestoRetenidoTrabajadorEsteEmpleador.toFixed(2),
  };
}

/** Valida (sin calcular todavía) que exista una tabla oficial para el año. */
export function verificarTablaImpuestoRentaDisponible(
  periodoFiscal: number,
): void {
  try {
    calcularImpuestoPersonaNaturalGeneral(periodoFiscal, 0);
  } catch {
    throw new BadRequestException(
      `No existe una tabla de Impuesto a la Renta verificada en FINTECH para el período fiscal ${periodoFiscal}. Debe actualizarse el módulo con la tabla oficial vigente del SRI antes de continuar.`,
    );
  }
}
