import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import type { FormularioRdepCompleto } from './rdep-validacion.service';
import { calcularResumenImpositivoRdep } from './utilidades/rdep-calculo';

/**
 * Genera el archivo que el SRI efectivamente pide para el Anexo RDEP.
 *
 * Aclaración importante (para que quede documentado en el propio código):
 * el SRI NO publica un XSD/XML abierto para armar el anexo a mano. El
 * mecanismo oficial es: (1) descargar la plantilla Excel del programa
 * "DIMM Formularios / RDEP" desde sri.gob.ec, (2) llenarla con la
 * información de cada trabajador respetando exactamente los nombres de
 * columna, catálogos y validaciones de la Ficha Técnica RDEP, y (3) esa
 * plantilla es la que el propio programa DIMM convierte al XML comprimido
 * que se sube a SRI en Línea. Por eso este servicio genera esa MISMA
 * plantilla oficial (dos hojas: "Datos del Empleador" y
 * "Retenciones Trabajadores", con los nombres de columna de la Ficha
 * Técnica) en vez de inventar un XML propio: es el formato real que hay
 * que producir para poder importarlo en DIMM y transmitirlo al SRI.
 *
 * Lo que falta para transmitir de verdad (no simulado, ver más abajo):
 *  - Tener instalado el programa oficial "DIMM Formularios" del SRI.
 *  - Importar este .xlsx en DIMM para que él genere el XML comprimido.
 *  - Tener clave de SRI en Línea vigente para subir ese XML.
 * FINTECH no incluye ni simula esos tres puntos: no hay forma de hacerlo
 * sin el software y las credenciales oficiales del SRI.
 */
@Injectable()
export class AnexoRdepExcelService {
  async generarAnexoExcel(
    formulario: FormularioRdepCompleto & {
      rucEmpleador: string;
      razonSocialEmpleador: string;
    },
  ): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'FINTECH';
    libro.created = new Date();

    this.crearHojaEmpleador(libro, formulario);
    this.crearHojaRetenciones(libro, formulario);

    const arrayBuffer = await libro.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private crearHojaEmpleador(
    libro: ExcelJS.Workbook,
    f: FormularioRdepCompleto & { rucEmpleador: string; razonSocialEmpleador: string },
  ): void {
    const hoja = libro.addWorksheet('Datos del Empleador');

    const columnas = [
      { header: 'Número de RUC del empleador', key: 'ruc', width: 18 },
      { header: 'Razón social del empleador', key: 'razonSocial', width: 40 },
      { header: 'Período (Año)', key: 'periodo', width: 14 },
      { header: 'Tipo de empleador', key: 'tipoEmpleador', width: 18 },
      { header: 'Ente de seguridad social', key: 'ente', width: 22 },
    ];
    hoja.columns = columnas;
    this.formatearEncabezado(hoja);

    hoja.addRow({
      ruc: f.rucEmpleador,
      razonSocial: this.normalizarTextoSri(f.razonSocialEmpleador),
      periodo: f.periodoFiscal,
      tipoEmpleador: f.tipoEmpleador,
      ente: f.enteSeguridadSocial,
    });
  }

  private crearHojaRetenciones(
    libro: ExcelJS.Workbook,
    f: FormularioRdepCompleto,
  ): void {
    const hoja = libro.addWorksheet('Retenciones Trabajadores');

    // Nombres de columna == nombres de casillero de la Ficha Técnica RDEP.
    const columnas = [
      { header: 'Tipo de identificación del trabajador', key: 'tipoId', width: 16 },
      { header: 'Número de identificación del trabajador', key: 'numeroId', width: 20 },
      { header: 'Apellidos del trabajador', key: 'apellidos', width: 30 },
      { header: 'Nombres del trabajador', key: 'nombres', width: 30 },
      { header: 'Código del establecimiento', key: 'establecimiento', width: 14 },
      { header: 'Residencia del trabajador', key: 'residencia', width: 14 },
      { header: 'País de residencia del trabajador', key: 'pais', width: 14 },
      { header: 'Aplica convenio doble imposición', key: 'convenio', width: 16 },
      { header: 'Condición discapacidad', key: 'discapacidad', width: 14 },
      { header: 'Porcentaje de discapacidad', key: 'porcentajeDiscapacidad', width: 14 },
      { header: 'Beneficio provincia de Galápagos', key: 'galapagos', width: 16 },
      { header: 'Enfermedad catastrófica', key: 'enfermedadCatastrofica', width: 14 },
      { header: 'Número de cargas familiares', key: 'cargas', width: 14 },
      { header: 'Sistema de salario neto', key: 'sistemaSalarioNeto', width: 14 },
      { header: '301 - Sueldos, salarios y otros ingresos gravados', key: 'c301', width: 18 },
      { header: '303 - Otros ingresos gravados', key: 'c303', width: 16 },
      { header: '305 - Participación de utilidades', key: 'c305', width: 16 },
      { header: '307 - Ingresos gravados con otros empleadores', key: 'c307', width: 18 },
      { header: '311 - Décimo tercer sueldo', key: 'c311', width: 14 },
      { header: '313 - Décimo cuarto sueldo', key: 'c313', width: 14 },
      { header: '315 - Fondo de reserva', key: 'c315', width: 14 },
      { header: '317 - Otros ingresos que no constituyen materia gravada', key: 'c317', width: 20 },
      { header: '351 - Aporte personal SS con este empleador', key: 'c351', width: 18 },
      { header: '353 - Aporte personal SS con otros empleadores', key: 'c353', width: 18 },
      { header: '361 - Gastos personales vivienda', key: 'c361', width: 16 },
      { header: '362 - Gastos personales turismo', key: 'c362', width: 16 },
      { header: '363 - Gastos personales salud', key: 'c363', width: 16 },
      { header: '365 - Gastos personales educación, arte y cultura', key: 'c365', width: 18 },
      { header: '367 - Gastos personales alimentación', key: 'c367', width: 16 },
      { header: '369 - Gastos personales vestimenta', key: 'c369', width: 16 },
      { header: '371 - Exoneración por discapacidad', key: 'c371', width: 16 },
      { header: '373 - Exoneración por tercera edad', key: 'c373', width: 16 },
      { header: '381 - Impuesto a la renta asumido por este empleador', key: 'c381', width: 18 },
      { header: '399 - Base imponible gravada', key: 'c399', width: 16 },
      { header: '401 - Impuesto a la renta causado', key: 'c401', width: 16 },
      { header: '402 - Rebaja por gastos personales', key: 'c402', width: 16 },
      { header: '403 - Impuesto causado después de rebaja', key: 'c403', width: 18 },
      { header: '404 - Retenido/asumido por otros empleadores', key: 'c404', width: 18 },
      { header: '405 - Asumido por este empleador', key: 'c405', width: 16 },
      { header: '407 - Retenido al trabajador por este empleador', key: 'c407', width: 18 },
      { header: '349 - Ingresos gravados con este empleador (informativo)', key: 'c349', width: 20 },
    ];
    hoja.columns = columnas;
    this.formatearEncabezado(hoja);

    const calculo = calcularResumenImpositivoRdep(f);
    const ingresosConEsteEmpleador = f.sueldosSalariosIngresosGravados;

    hoja.addRow({
      tipoId: this.codigoTipoIdentificacion(f.tipoIdentificacionTrabajador),
      numeroId: f.numeroIdentificacionTrabajador,
      apellidos: this.normalizarTextoSri(f.apellidosTrabajador),
      nombres: this.normalizarTextoSri(f.nombresTrabajador),
      establecimiento: f.codigoEstablecimiento,
      residencia: f.residenciaTrabajador === 'LOCAL' ? '01' : '02',
      pais: f.paisResidenciaTrabajador,
      convenio: this.codigoConvenioDobleImposicion(f.aplicaConvenioDobleImposicion),
      discapacidad: this.codigoCondicionDiscapacidad(f.condicionDiscapacidad),
      porcentajeDiscapacidad: f.porcentajeDiscapacidad ?? 0,
      galapagos: f.beneficioGalapagos ? 'SI' : 'NO',
      enfermedadCatastrofica: f.enfermedadCatastrofica ? 'SI' : 'NO',
      cargas: f.cargasFamiliares,
      sistemaSalarioNeto: this.codigoSistemaSalarioNeto(f.sistemaSalarioNeto),
      c301: this.aNumero(f.sueldosSalariosIngresosGravados),
      c303: this.aNumero(f.otrosIngresosGravados),
      c305: this.aNumero(f.participacionUtilidades),
      c307: this.aNumero(f.ingresosOtrosEmpleadores),
      c311: this.aNumero(f.decimoTercerSueldo),
      c313: this.aNumero(f.decimoCuartoSueldo),
      c315: this.aNumero(f.fondoReserva),
      c317: this.aNumero(f.otrosIngresosNoGravados),
      c351: this.aNumero(f.aportePersonalEsteEmpleador),
      c353: this.aNumero(f.aportePersonalOtrosEmpleadores),
      c361: this.aNumero(f.gastoVivienda),
      c362: this.aNumero(f.gastoTurismo),
      c363: this.aNumero(f.gastoSalud),
      c365: this.aNumero(f.gastoEducacion),
      c367: this.aNumero(f.gastoAlimentacion),
      c369: this.aNumero(f.gastoVestimenta),
      c371: this.aNumero(f.exoneracionDiscapacidad),
      c373: this.aNumero(f.exoneracionTerceraEdad),
      c381: this.aNumero(f.impuestoRentaAsumidoEmpleador),
      c399: Number(calculo.baseImponibleGravada),
      c401: Number(calculo.impuestoRentaCausado),
      c402: Number(calculo.rebajaGastosPersonales),
      c403: Number(calculo.impuestoRentaCausadoDespuesRebaja),
      c404: this.aNumero(f.impuestoRetenidoAsumidoOtrosEmpleadores),
      c405: this.aNumero(f.impuestoAsumidoEsteEmpleador),
      c407: Number(calculo.impuestoRetenidoTrabajadorEsteEmpleador),
      c349: this.aNumero(ingresosConEsteEmpleador),
    });
  }

  private formatearEncabezado(hoja: ExcelJS.Worksheet): void {
    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    hoja.getRow(1).height = 30;
  }

  private aNumero(valor: unknown): number {
    return Number(valor ?? 0);
  }

  private codigoTipoIdentificacion(
    tipo: 'CEDULA' | 'IDENTIFICACION_EXTERIOR' | 'PASAPORTE',
  ): string {
    if (tipo === 'CEDULA') return 'C';
    if (tipo === 'PASAPORTE') return 'P';
    return 'E';
  }

  private codigoCondicionDiscapacidad(
    condicion: 'NO_APLICA' | 'CON_DISCAPACIDAD' | 'SUSTITUTO',
  ): string {
    if (condicion === 'CON_DISCAPACIDAD') return '02';
    if (condicion === 'SUSTITUTO') return '03';
    return '01';
  }

  /** Códigos de la Ficha Técnica RDEP: NA (no aplica) / NO / SI. */
  private codigoConvenioDobleImposicion(
    convenio: 'SI' | 'NO' | 'NO_APLICA',
  ): string {
    return convenio === 'NO_APLICA' ? 'NA' : convenio;
  }

  /** Códigos de la Ficha Técnica RDEP: 1 (sin sistema) / 2 (con sistema). */
  private codigoSistemaSalarioNeto(
    sistema: 'SIN_SISTEMA' | 'CON_SISTEMA',
  ): string {
    return sistema === 'CON_SISTEMA' ? '2' : '1';
  }

  /**
   * El SRI exige nombres sin caracteres especiales y con "ñ" escrita como
   * "n" (Ficha Técnica RDEP). Esta normalización solo se aplica al archivo
   * oficial de exportación; en la base de datos y en la vista previa se
   * conserva el nombre tal como el usuario lo escribió.
   */
  private normalizarTextoSri(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ñÑ]/g, 'n')
      .toUpperCase();
  }
}
