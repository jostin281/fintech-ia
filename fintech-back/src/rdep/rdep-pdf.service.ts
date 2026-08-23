import { Injectable } from '@nestjs/common';

import { BorradoresSriExportacionService } from '../facturacion/borradores-sri-exportacion.service';
import type { GenerarBorradorSriDto } from '../facturacion/dto/generar-borrador-sri.dto';
import type { FormularioRdepCompleto } from './rdep-validacion.service';
import { calcularResumenImpositivoRdep } from './utilidades/rdep-calculo';

export interface DatosPdfFormularioRdep extends FormularioRdepCompleto {
  id: number;
  estado: 'BORRADOR' | 'VALIDADO' | 'GENERADO';
  rucEmpleador: string;
  razonSocialEmpleador: string;
}

/**
 * Vista previa / documento final del Formulario 107 en PDF. Es la MISMA
 * plantilla visual de FINTECH que ya existía (encabezado azul + tabla de
 * casilleros, ver BorradoresSriExportacionService.dibujarFormulario107):
 * este servicio solo traduce un FormularioRdep (persistido en BD) al mismo
 * formato de entrada que ya consumía esa plantilla, para no duplicar el
 * código de dibujo del PDF.
 */
@Injectable()
export class RdepPdfService {
  constructor(
    private readonly borradoresSriExportacionService: BorradoresSriExportacionService,
  ) {}

  async generarPdf(formulario: DatosPdfFormularioRdep): Promise<Buffer> {
    const calculo = calcularResumenImpositivoRdep(formulario);

    const dto: GenerarBorradorSriDto = {
      tipoFormulario: 'Formulario 107 (Retenciones Relación de Dependencia)',
      periodo: String(formulario.periodoFiscal),
      ruc: formulario.rucEmpleador,
      numeroAdhesion: `RDEP-${formulario.periodoFiscal}-${String(formulario.id).padStart(6, '0')}`,
      nombreContribuyente: `${formulario.nombresTrabajador} ${formulario.apellidosTrabajador}`,
      resultadoEtiqueta: 'Casillero 407 · Valor del Impuesto Retenido al Trabajador',
      resultadoValor: `$${calculo.impuestoRetenidoTrabajadorEsteEmpleador} USD${
        formulario.estado === 'GENERADO' ? '' : ' (BORRADOR — sin generar)'
      }`,
      lineas: [
        {
          etiqueta:
            'Casillero 301 · Sueldos, salarios y otros ingresos gravados (materia gravada seguridad social)',
          valor: `+$${Number(formulario.sueldosSalariosIngresosGravados).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 303 · Otros ingresos gravados',
          valor: `+$${Number(formulario.otrosIngresosGravados).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 305 · Participación utilidades',
          valor: `+$${Number(formulario.participacionUtilidades).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 307 · Ingresos gravados generados con otros empleadores',
          valor: `+$${Number(formulario.ingresosOtrosEmpleadores).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 311 · Décimo tercer sueldo (exento)',
          valor: `$${Number(formulario.decimoTercerSueldo).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 313 · Décimo cuarto sueldo (exento)',
          valor: `$${Number(formulario.decimoCuartoSueldo).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 315 · Fondo de reserva (exento)',
          valor: `$${Number(formulario.fondoReserva).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 317 · Otros ingresos que no constituyen materia gravada',
          valor: `+$${Number(formulario.otrosIngresosNoGravados).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 351 · Aporte personal a la seguridad social con este empleador',
          valor: `-$${Number(formulario.aportePersonalEsteEmpleador).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 353 · Aporte personal a la seguridad social con otros empleadores',
          valor: `-$${Number(formulario.aportePersonalOtrosEmpleadores).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 361 · Gastos personales Vivienda (Informativo)',
          valor: `$${Number(formulario.gastoVivienda).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 362 · Gastos personales Turismo (Informativo)',
          valor: `$${Number(formulario.gastoTurismo).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 363 · Gastos personales Salud (Informativo)',
          valor: `$${Number(formulario.gastoSalud).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 365 · Gastos personales Educación, Arte y Cultura (Informativo)',
          valor: `$${Number(formulario.gastoEducacion).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 367 · Gastos personales Alimentación (Informativo)',
          valor: `$${Number(formulario.gastoAlimentacion).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 369 · Gastos personales Vestimenta (Informativo)',
          valor: `$${Number(formulario.gastoVestimenta).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 371 · Exoneración por discapacidad',
          valor: `-$${Number(formulario.exoneracionDiscapacidad).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 373 · Exoneración por tercera edad',
          valor: `-$${Number(formulario.exoneracionTerceraEdad).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 381 · Impuesto a la renta asumido por este empleador',
          valor: `+$${Number(formulario.impuestoRentaAsumidoEmpleador).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 399 · Base Imponible Gravada',
          valor: `$${calculo.baseImponibleGravada} USD`,
        },
        {
          etiqueta: 'Casillero 401 · Impuesto a la Renta Causado',
          valor: `$${calculo.impuestoRentaCausado} USD`,
        },
        {
          etiqueta: 'Casillero 402 · Rebaja por Gastos Personales',
          valor: `-$${calculo.rebajaGastosPersonales} USD`,
        },
        {
          etiqueta: 'Casillero 403 · Impuesto a la Renta Después de la Rebaja',
          valor: `$${calculo.impuestoRentaCausadoDespuesRebaja} USD`,
        },
        {
          etiqueta:
            'Casillero 404 · Impuesto retenido y asumido por otros empleadores en el período',
          valor: `$${Number(formulario.impuestoRetenidoAsumidoOtrosEmpleadores).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 405 · Impuesto asumido por este empleador',
          valor: `$${Number(formulario.impuestoAsumidoEsteEmpleador).toFixed(2)} USD`,
        },
        {
          etiqueta: 'Casillero 407 · Valor del Impuesto Retenido al Trabajador por este Empleador',
          valor: `$${calculo.impuestoRetenidoTrabajadorEsteEmpleador} USD`,
        },
        {
          etiqueta: 'Casillero 349 · Ingresos Gravados con este Empleador (informativo)',
          valor: `$${Number(formulario.sueldosSalariosIngresosGravados).toFixed(2)} USD`,
        },
      ],
    };

    return this.borradoresSriExportacionService.generarPdf(dto);
  }
}
