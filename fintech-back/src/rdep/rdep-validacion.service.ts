import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

import { esCedulaEcuadorValida } from '../facturacion/utilidades/identificacion-ecuador';
import { existeCodigoPaisRdep } from './utilidades/catalogo-paises-rdep';
import { esCompatibleEmpleadorConEnteSeguridadSocial } from './utilidades/catalogos-rdep';
import {
  calcularResumenImpositivoRdep,
  type DatosCalculoRdep,
} from './utilidades/rdep-calculo';

/** Un registro completo de FormularioRdep, tal como sale de Prisma. */
export interface FormularioRdepCompleto extends DatosCalculoRdep {
  tipoEmpleador: 'PRIVADO_MIXTO' | 'PUBLICO';
  enteSeguridadSocial: 'IESS' | 'ISSFA_ISSPOL';
  tipoIdentificacionTrabajador:
    | 'CEDULA'
    | 'IDENTIFICACION_EXTERIOR'
    | 'PASAPORTE';
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
  sistemaSalarioNeto: 'SIN_SISTEMA' | 'CON_SISTEMA';
  // Casilleros exentos (311, 313, 315) e informativo no gravado (317): no
  // participan en el cálculo de 399/401-403/407 (por eso no están en
  // DatosCalculoRdep), pero sí se muestran en el PDF y se reportan en el
  // anexo Excel oficial tal como se capturaron.
  decimoTercerSueldo: Decimal.Value;
  decimoCuartoSueldo: Decimal.Value;
  fondoReserva: Decimal.Value;
  otrosIngresosNoGravados: Decimal.Value;
}

/**
 * Un error de validación tal como lo pide el punto 14 del encargo: campo
 * afectado, valor ingresado, motivo del error y forma de corregirlo.
 */
export interface ErrorValidacionRdep {
  campo: string;
  valorIngresado: string;
  motivo: string;
  comoCorregirlo: string;
}

@Injectable()
export class RdepValidacionService {
  /**
   * Corre TODAS las reglas de negocio del Anexo RDEP / Formulario 107 sobre
   * un formulario ya guardado. No lanza excepciones: devuelve la lista de
   * errores encontrados (vacía si todo está correcto) para que el
   * controlador se la muestre completa al usuario de una sola vez, en vez
   * de detenerse en el primer error.
   */
  validar(formulario: FormularioRdepCompleto): ErrorValidacionRdep[] {
    const errores: ErrorValidacionRdep[] = [];

    this.validarIdentificacionTrabajador(formulario, errores);
    this.validarResidenciaYPais(formulario, errores);
    this.validarDiscapacidad(formulario, errores);
    this.validarCompatibilidadEmpleador(formulario, errores);
    this.validarConsistenciaMontos(formulario, errores);

    return errores;
  }

  private validarIdentificacionTrabajador(
    f: FormularioRdepCompleto,
    errores: ErrorValidacionRdep[],
  ): void {
    const numero = f.numeroIdentificacionTrabajador;

    if (f.tipoIdentificacionTrabajador === 'CEDULA') {
      if (!/^\d{10}$/.test(numero) || !esCedulaEcuadorValida(numero)) {
        errores.push({
          campo: 'numeroIdentificacionTrabajador',
          valorIngresado: numero,
          motivo:
            'El tipo de identificación es "Cédula" pero el número no tiene 10 dígitos o el dígito verificador no es válido.',
          comoCorregirlo:
            'Ingresa la cédula ecuatoriana completa de 10 dígitos, o cambia el tipo de identificación a "Pasaporte" / "Identificación del exterior" si corresponde.',
        });
      }
    } else if (!/^[A-Za-z0-9]{3,13}$/.test(numero)) {
      errores.push({
        campo: 'numeroIdentificacionTrabajador',
        valorIngresado: numero,
        motivo:
          'Para pasaporte o identificación del exterior, el número debe tener entre 3 y 13 caracteres alfanuméricos, sin símbolos.',
        comoCorregirlo:
          'Corrige el número de identificación para que tenga entre 3 y 13 letras/números, sin espacios ni símbolos.',
      });
    }

    if (!/^\d{3}$/.test(f.codigoEstablecimiento)) {
      errores.push({
        campo: 'codigoEstablecimiento',
        valorIngresado: f.codigoEstablecimiento,
        motivo: 'El código de establecimiento debe tener exactamente 3 dígitos.',
        comoCorregirlo:
          'Usa el código de 3 dígitos del establecimiento registrado en tu RUC (por defecto "001").',
      });
    }
  }

  private validarResidenciaYPais(
    f: FormularioRdepCompleto,
    errores: ErrorValidacionRdep[],
  ): void {
    if (f.residenciaTrabajador === 'LOCAL' && f.paisResidenciaTrabajador !== '593') {
      errores.push({
        campo: 'paisResidenciaTrabajador',
        valorIngresado: f.paisResidenciaTrabajador,
        motivo:
          'La residencia está marcada como "Local" pero el país de residencia no es Ecuador (593).',
        comoCorregirlo:
          'Cambia el país a 593 (Ecuador), o cambia la residencia a "Exterior" si el trabajador realmente vive fuera del país.',
      });
    }

    if (f.residenciaTrabajador === 'EXTERIOR') {
      if (!/^\d{1,3}$/.test(f.paisResidenciaTrabajador)) {
        errores.push({
          campo: 'paisResidenciaTrabajador',
          valorIngresado: f.paisResidenciaTrabajador,
          motivo: 'El código de país debe ser numérico (según el catálogo del SRI).',
          comoCorregirlo:
            'Selecciona el país desde el catálogo (GET /api/rdep/catalogos) o ingresa el código numérico oficial.',
        });
      } else if (!existeCodigoPaisRdep(f.paisResidenciaTrabajador)) {
        errores.push({
          campo: 'paisResidenciaTrabajador',
          valorIngresado: f.paisResidenciaTrabajador,
          motivo:
            'El código no está en el catálogo parcial que tiene FINTECH cargado (solo incluye los países más frecuentes).',
          comoCorregirlo:
            'Verifica el código exacto en la tabla de países vigente del Anexo RDEP en sri.gob.ec antes de generar el archivo definitivo.',
        });
      }
    }
  }

  private validarDiscapacidad(
    f: FormularioRdepCompleto,
    errores: ErrorValidacionRdep[],
  ): void {
    const requiereDiscapacidad = f.condicionDiscapacidad !== 'NO_APLICA';

    if (requiereDiscapacidad && !f.porcentajeDiscapacidad) {
      errores.push({
        campo: 'porcentajeDiscapacidad',
        valorIngresado: String(f.porcentajeDiscapacidad ?? ''),
        motivo:
          'La condición de discapacidad exige indicar el porcentaje de discapacidad (1 a 100).',
        comoCorregirlo:
          'Ingresa el porcentaje de discapacidad del carnet del CONADIS, o cambia la condición a "No aplica" si no corresponde.',
      });
    }

    if (!requiereDiscapacidad && f.porcentajeDiscapacidad) {
      errores.push({
        campo: 'porcentajeDiscapacidad',
        valorIngresado: String(f.porcentajeDiscapacidad),
        motivo:
          'La condición de discapacidad es "No aplica" pero se ingresó un porcentaje de discapacidad.',
        comoCorregirlo:
          'Borra el porcentaje de discapacidad, o cambia la condición a "Con discapacidad" / "Sustituto" si corresponde.',
      });
    }
  }

  private validarCompatibilidadEmpleador(
    f: FormularioRdepCompleto,
    errores: ErrorValidacionRdep[],
  ): void {
    if (
      !esCompatibleEmpleadorConEnteSeguridadSocial(
        f.tipoEmpleador,
        f.enteSeguridadSocial,
      )
    ) {
      errores.push({
        campo: 'enteSeguridadSocial',
        valorIngresado: f.enteSeguridadSocial,
        motivo:
          'Un empleador "Privado o mixto" solo puede reportar aportes al IESS (no ISSFA/ISSPOL).',
        comoCorregirlo:
          'Cambia el ente de seguridad social a IESS, o cambia el tipo de empleador a "Público" si corresponde a las Fuerzas Armadas o la Policía.',
      });
    }
  }

  private validarConsistenciaMontos(
    f: FormularioRdepCompleto,
    errores: ErrorValidacionRdep[],
  ): void {
    const ingresosGravados = new Decimal(f.sueldosSalariosIngresosGravados)
      .plus(f.otrosIngresosGravados)
      .plus(f.participacionUtilidades)
      .plus(f.ingresosOtrosEmpleadores)
      .plus(f.impuestoRentaAsumidoEmpleador);

    const aportesPersonales = new Decimal(f.aportePersonalEsteEmpleador).plus(
      f.aportePersonalOtrosEmpleadores,
    );

    if (aportesPersonales.greaterThan(ingresosGravados)) {
      errores.push({
        campo: 'aportePersonalEsteEmpleador',
        valorIngresado: aportesPersonales.toFixed(2),
        motivo:
          'La suma de los aportes personales al IESS (casilleros 351 + 353) no puede ser mayor que los ingresos gravados (301+303+305+307+381).',
        comoCorregirlo:
          'Revisa los valores de aporte personal o de ingresos: el aporte al IESS es un porcentaje del ingreso, nunca puede superarlo.',
      });
    }

    if (f.canastaBasicaMensual === undefined || Number(f.canastaBasicaMensual) <= 0) {
      errores.push({
        campo: 'canastaBasicaMensual',
        valorIngresado: String(f.canastaBasicaMensual ?? ''),
        motivo:
          'Falta la Canasta Familiar Básica (diciembre, INEC) usada para calcular la rebaja por gastos personales.',
        comoCorregirlo:
          'Ingresa el valor oficial de la Canasta Familiar Básica de diciembre del período fiscal (publicado por el INEC).',
      });
    }

    // Recalcula 401/402/403/407 con los datos actuales para revisar que el
    // impuesto retenido/asumido por otros canales (404+405) no exceda el
    // impuesto causado después de la rebaja (403): sería una inconsistencia
    // tributaria (estarían "cubriendo" más impuesto del que existe).
    try {
      const resultado = calcularResumenImpositivoRdep(f);
      const otrosCanales = new Decimal(
        f.impuestoRetenidoAsumidoOtrosEmpleadores,
      ).plus(f.impuestoAsumidoEsteEmpleador);

      if (
        otrosCanales.greaterThan(
          new Decimal(resultado.impuestoRentaCausadoDespuesRebaja),
        )
      ) {
        errores.push({
          campo: 'impuestoRetenidoAsumidoOtrosEmpleadores',
          valorIngresado: otrosCanales.toFixed(2),
          motivo:
            'Lo retenido/asumido por otros empleadores (404) más lo asumido por este empleador (405) supera el impuesto causado después de la rebaja (403): no puede haber más impuesto cubierto que impuesto causado.',
          comoCorregirlo:
            'Revisa los casilleros 404 y 405, o revisa los ingresos y gastos personales que determinan el casillero 403.',
        });
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      errores.push({
        campo: 'periodoFiscal',
        valorIngresado: String(f.periodoFiscal),
        motivo: mensaje,
        comoCorregirlo:
          'Elige un período fiscal para el que FINTECH ya tenga cargada la tabla oficial de Impuesto a la Renta, o solicita que se agregue la tabla del año correspondiente antes de continuar.',
      });
    }
  }
}
