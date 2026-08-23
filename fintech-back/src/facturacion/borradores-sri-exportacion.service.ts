import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import type { GenerarBorradorSriDto } from './dto/generar-borrador-sri.dto';

const MARGEN = 50;
const ANCHO_UTIL = 495; // A4 (595.28pt) - 2*50 de margen, redondeado

// Orden de columnas de la tabla "Liquidación del Impuesto" del Formulario
// 107 real del SRI: etiqueta (ancha, izquierda) → número de casillero
// (angosta) → valor (derecha). Ver dibujarFormulario107()/filaCasillero().
const COL_ETQ_X = MARGEN;
const COL_ETQ_W = 360;
const COL_NUM_X = COL_ETQ_X + COL_ETQ_W;
const COL_NUM_W = 35;
const COL_VAL_X = COL_NUM_X + COL_NUM_W;
const COL_VAL_W = ANCHO_UTIL - COL_ETQ_W - COL_NUM_W;

const AZUL_SRI = '#0b3d91';
const AMBAR = '#fde68a';
const GRIS_BORDE = '#94a3b8';

/** Una fila ya separada en "número de casillero" (si aplica) y el resto de la etiqueta. */
interface FilaParseada {
  numero: string;
  texto: string;
  esTotal: boolean;
}

/**
 * Genera el PDF real de un "borrador" de formulario SRI (104 o 107) a partir
 * de las cifras ya calculadas en el simulador. Para el Formulario 107 imita
 * la estructura visual del formulario oficial del SRI (encabezado con marca
 * "SRI", período/identificación y tabla de casilleros numerados); para el
 * 104 usa la misma tabla de casilleros en un formato más compacto. Es un
 * documento informativo para el usuario, no una presentación oficial ante el
 * SRI (el SRI no expone una API pública para terceros) — el aviso de
 * "borrador / no oficial" se mantiene siempre visible en el encabezado y en
 * el pie de ambos formatos.
 */
@Injectable()
export class BorradoresSriExportacionService {
  generarPdf(dto: GenerarBorradorSriDto): Promise<Buffer> {
    const es107 = dto.tipoFormulario.includes('107');
    const es104 = dto.tipoFormulario.includes('104');

    const documento = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      info: {
        Title: `Borrador SRI - ${dto.tipoFormulario}`,
        Author: 'Sistema Fintech',
      },
    });

    const fragmentos: Buffer[] = [];

    return new Promise<Buffer>((resolver, rechazar) => {
      documento.on('data', (fragmento: Buffer) => fragmentos.push(fragmento));
      documento.on('end', () => resolver(Buffer.concat(fragmentos)));
      documento.on('error', (error: Error) => rechazar(error));

      if (es107) {
        this.dibujarFormulario107(documento, dto);
      } else if (es104) {
        this.dibujarFormulario104(documento, dto);
      } else {
        this.dibujarFormularioGenerico(documento, dto);
      }

      documento.end();
    });
  }

  // ── FORMULARIO 107 (imita la estructura visual oficial del SRI) ──
  private dibujarFormulario107(documento: PDFKit.PDFDocument, dto: GenerarBorradorSriDto): void {
    let y = MARGEN;

    // Encabezado estilo SRI: marca "SRI" en caja azul a la izquierda y
    // título del formulario a la derecha, sobre fondo blanco — igual al
    // formulario oficial que sirvió de referencia (ya no la barra sólida
    // azul de ancho completo que se usaba antes).
    const altoLogo = 34;
    documento.rect(MARGEN, y, altoLogo, altoLogo).fill(AZUL_SRI);
    documento
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('SRI', MARGEN, y + 10, { width: altoLogo, align: 'center' });
    documento
      .fillColor(AZUL_SRI)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('Formulario 107', MARGEN + altoLogo + 10, y + 2, { width: ANCHO_UTIL - altoLogo - 10 });
    documento
      .fillColor('#4b5563')
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        'Comprobante de retenciones en la fuente del Impuesto a la Renta por ingresos del trabajo en relación de dependencia',
        MARGEN + altoLogo + 10,
        y + 20,
        { width: ANCHO_UTIL - altoLogo - 10 },
      );
    documento.fillColor('#000000').font('Helvetica');
    y += altoLogo + 6;

    // Aviso de "borrador / no oficial", siempre visible junto al título (no
    // solo al final del documento).
    documento
      .fontSize(7)
      .font('Helvetica-Bold')
      .fillColor('#b45309')
      .text('BORRADOR — documento informativo generado por Fintech, no presentado ante el SRI', MARGEN, y, {
        width: ANCHO_UTIL,
      });
    documento.font('Helvetica').fillColor('#000000');
    y = documento.y + 6;

    documento.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO_UTIL, y).strokeColor(AZUL_SRI).lineWidth(1.2).stroke();
    y += 10;

    // Período fiscal / Fecha de entrega.
    y = this.filaDosColumnas(documento, y, 'Periodo fiscal', dto.periodo, 'Fecha de entrega', this.fechaHoyLegible());

    // Identificación del empleador (autoempleado: mismos datos que el trabajador).
    y = this.encabezadoSeccionAzul(documento, y, 'Identificación del empleador (Agente de Retención)');
    y = this.filaSimple(documento, y, 'RUC', dto.ruc);
    y = this.filaSimple(documento, y, 'Razón social o apellidos y nombres completos', dto.nombreContribuyente || '—');

    y = this.encabezadoSeccionAzul(documento, y, 'Identificación del trabajador (Contribuyente)');
    y = this.filaSimple(documento, y, 'Cédula o Pasaporte', dto.ruc);
    y = this.filaSimple(documento, y, 'Apellidos y nombres completos', dto.nombreContribuyente || '—');

    y += 8;
    y = this.encabezadoSeccionAzul(documento, y, 'Liquidación del Impuesto');

    for (const linea of dto.lineas) {
      y = this.verificarSaltoDePagina(documento, y, 20);
      y = this.filaCasillero(documento, y, linea.etiqueta, linea.valor);
    }

    y += 10;
    y = this.verificarSaltoDePagina(documento, y, 40);
    y = this.filaResultado(documento, y, dto.resultadoEtiqueta, dto.resultadoValor);

    y = this.verificarSaltoDePagina(documento, y, 24);
    documento
      .fontSize(7.5)
      .fillColor('#6b7280')
      .text(`Código único: ${dto.numeroAdhesion}`, MARGEN, y, { width: ANCHO_UTIL, align: 'center' });
    y = documento.y + 2;
    documento
      .fontSize(6)
      .fillColor('#9ca3af')
      .text('(referencia interna de Fintech — no corresponde a un número de trámite del SRI)', MARGEN, y, {
        width: ANCHO_UTIL,
        align: 'center',
      });
    y = documento.y + 16;

    this.pieAviso(documento, y, true);
  }

  // ── FORMULARIO 104 (imita el comprobante real de "Declaración de IVA" del
  //    Sistema de declaración de impuestos del SRI por internet) ──
  private dibujarFormulario104(documento: PDFKit.PDFDocument, dto: GenerarBorradorSriDto): void {
    let y = MARGEN;

    // Encabezado "Sistema de declaración de impuestos a través de internet":
    // banda azul de ancho completo, con "SRI" y el título en blanco — el
    // mismo estilo del comprobante real de declaración de IVA (distinto del
    // 107, que es un comprobante de retención y no una declaración
    // presentada).
    const altoBanda = 62;
    documento.rect(MARGEN, y, ANCHO_UTIL, altoBanda).fill(AZUL_SRI);
    documento
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('SRI', MARGEN + 14, y + 18, { width: 90 });
    documento
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('Sistema de declaración de impuestos', MARGEN + 110, y + 16, { width: ANCHO_UTIL - 124 });
    documento
      .font('Helvetica')
      .fontSize(9)
      .text('a través de internet', MARGEN + 110, y + 36, { width: ANCHO_UTIL - 124 });
    documento.fillColor('#000000').font('Helvetica');
    y += altoBanda + 10;

    // Aviso de "borrador / no oficial", siempre visible junto al título (no
    // solo al final del documento). No se incluyen el código verificador,
    // número serial ni "Estado de la Declaración: CUMPLIDA" del comprobante
    // real: este PDF no es una declaración presentada ante el SRI.
    documento
      .fontSize(7)
      .font('Helvetica-Bold')
      .fillColor('#b45309')
      .text('BORRADOR — documento informativo generado por Fintech, no presentado ante el SRI', MARGEN, y, {
        width: ANCHO_UTIL,
      });
    documento.font('Helvetica').fillColor('#000000');
    y = documento.y + 10;

    // Bloque de identificación en texto plano, sin recuadros — igual al
    // comprobante real ("Obligación Tributaria / Identificación / Razón
    // Social / Período Fiscal / Tipo Declaración").
    y = this.filaInfoPlana(
      documento,
      y,
      'Obligación Tributaria',
      '2011 — Declaración de IVA',
      'Tipo de declaración',
      'ORIGINAL',
    );
    y = this.filaInfoPlana(documento, y, 'Identificación', dto.ruc, 'Razón Social', dto.nombreContribuyente || '—');
    y = this.filaInfoPlana(documento, y, 'Período Fiscal', dto.periodo, 'Fecha de generación', this.fechaHoyLegible());

    y += 8;
    y = this.encabezadoSeccionAzul(documento, y, 'Detalle del cálculo');

    dto.lineas.forEach((linea, indice) => {
      y = this.verificarSaltoDePagina(documento, y, 20);
      y = this.filaCasillero(documento, y, linea.etiqueta, linea.valor, indice % 2 === 1);
    });

    y += 10;
    y = this.verificarSaltoDePagina(documento, y, 40);
    y = this.filaResultado(documento, y, dto.resultadoEtiqueta, dto.resultadoValor);

    y = this.verificarSaltoDePagina(documento, y, 24);
    documento
      .fontSize(7.5)
      .fillColor('#6b7280')
      .text(`Código único: ${dto.numeroAdhesion}`, MARGEN, y, { width: ANCHO_UTIL, align: 'center' });
    y = documento.y + 2;
    documento
      .fontSize(6)
      .fillColor('#9ca3af')
      .text('(referencia interna de Fintech — no corresponde a un número de trámite del SRI)', MARGEN, y, {
        width: ANCHO_UTIL,
        align: 'center',
      });
    y = documento.y + 16;

    this.pieAviso(documento, y, false);
  }

  // ── Cualquier otro tipo de formulario: tabla de casilleros compacta ──
  private dibujarFormularioGenerico(documento: PDFKit.PDFDocument, dto: GenerarBorradorSriDto): void {
    let y = MARGEN;

    documento.rect(MARGEN, y, ANCHO_UTIL, 40).fill(AZUL_SRI);
    documento
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('SRI', MARGEN + 6, y + 7, { width: 60 });
    documento
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(dto.tipoFormulario, MARGEN, y + 6, { width: ANCHO_UTIL - 12, align: 'right' });
    documento
      .font('Helvetica')
      .fontSize(8)
      .text('Borrador de Declaración SRI', MARGEN, y + 22, { width: ANCHO_UTIL - 12, align: 'right' });
    documento.fillColor('#000000').font('Helvetica');
    y += 40 + 8;

    y = this.filaDosColumnas(documento, y, 'Período', dto.periodo, 'Fecha de generación', this.fechaHoyLegible());
    y = this.filaSimple(documento, y, 'RUC / Identificación', dto.ruc);
    if (dto.nombreContribuyente) {
      y = this.filaSimple(documento, y, 'Contribuyente', dto.nombreContribuyente);
    }

    y += 8;
    y = this.encabezadoSeccionAzul(documento, y, 'Detalle del cálculo');

    for (const linea of dto.lineas) {
      y = this.verificarSaltoDePagina(documento, y, 20);
      y = this.filaCasillero(documento, y, linea.etiqueta, linea.valor);
    }

    y += 10;
    y = this.verificarSaltoDePagina(documento, y, 40);
    y = this.filaResultado(documento, y, dto.resultadoEtiqueta, dto.resultadoValor);

    y = this.verificarSaltoDePagina(documento, y, 24);
    documento
      .fontSize(7)
      .fillColor('#6b7280')
      .text(`Número de adhesión (referencia interna): ${dto.numeroAdhesion}`, MARGEN, y, {
        width: ANCHO_UTIL,
        align: 'center',
      });
    y = documento.y + 16;

    this.pieAviso(documento, y, false);
  }

  // ────────────────────────── helpers de dibujo ──────────────────────────

  private encabezadoSeccionAzul(documento: PDFKit.PDFDocument, y: number, texto: string): number {
    const alto = 18;
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).fill(AZUL_SRI);
    documento
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(texto, MARGEN + 4, y + 4, { width: ANCHO_UTIL - 8 });
    documento.fillColor('#000000').font('Helvetica');
    return y + alto;
  }

  private filaSimple(documento: PDFKit.PDFDocument, y: number, etiqueta: string, valor: string): number {
    const anchoEtq = 180;
    const alto = 16;
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).strokeColor(GRIS_BORDE).lineWidth(0.5).stroke();
    documento.moveTo(MARGEN + anchoEtq, y).lineTo(MARGEN + anchoEtq, y + alto).strokeColor(GRIS_BORDE).stroke();
    documento
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(etiqueta, MARGEN + 4, y + 4, { width: anchoEtq - 8 });
    documento
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(8)
      .text(valor, MARGEN + anchoEtq + 6, y + 4, { width: ANCHO_UTIL - anchoEtq - 10 });
    return y + alto;
  }

  private filaDosColumnas(
    documento: PDFKit.PDFDocument,
    y: number,
    etiqueta1: string,
    valor1: string,
    etiqueta2: string,
    valor2: string,
  ): number {
    const alto = 16;
    const mitad = ANCHO_UTIL / 2;
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).strokeColor(GRIS_BORDE).lineWidth(0.5).stroke();
    documento.moveTo(MARGEN + mitad, y).lineTo(MARGEN + mitad, y + alto).strokeColor(GRIS_BORDE).stroke();
    documento
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(etiqueta1, MARGEN + 4, y + 4, { width: mitad / 2 });
    documento
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(8)
      .text(valor1, MARGEN + mitad / 2, y + 4, { width: mitad / 2 - 8 });
    documento
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(etiqueta2, MARGEN + mitad + 4, y + 4, { width: mitad / 2 });
    documento
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(8)
      .text(valor2, MARGEN + mitad + mitad / 2, y + 4, { width: mitad / 2 - 8 });
    return y + alto;
  }

  /**
   * Par de "Etiqueta: Valor" en texto plano, sin recuadros — el bloque de
   * identificación del comprobante real de "Sistema de declaración de
   * impuestos" del SRI no usa tablas con bordes, a diferencia de la tabla
   * de casilleros. Se usa en dibujarFormulario104().
   */
  private filaInfoPlana(
    documento: PDFKit.PDFDocument,
    y: number,
    etiqueta1: string,
    valor1: string,
    etiqueta2: string,
    valor2: string,
  ): number {
    const mitad = ANCHO_UTIL / 2;
    const alto = 14;
    documento.fillColor('#374151').font('Helvetica').fontSize(8).text(`${etiqueta1}:`, MARGEN, y, { width: 130 });
    documento
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(valor1, MARGEN + 132, y, { width: mitad - 136 });
    documento
      .fillColor('#374151')
      .font('Helvetica')
      .text(`${etiqueta2}:`, MARGEN + mitad, y, { width: 130 });
    documento
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(valor2, MARGEN + mitad + 132, y, { width: ANCHO_UTIL - mitad - 136 });
    documento.font('Helvetica').fillColor('#000000');
    return y + alto;
  }

  /**
   * Dibuja una fila de la tabla de "Liquidación del Impuesto". Si la
   * etiqueta viene con el prefijo "Casillero(s) NNN · texto" (como la arma
   * el frontend), separa el número en su propia columna angosta, igual que
   * el formulario oficial. Resalta en ámbar las filas de subtotal (Base
   * Imponible / Ingresos Gravados / totales) y en celeste la celda del
   * número de casillero (igual que el comprobante real del SRI). Con
   * `zebra` en true, además sombrea de gris claro las filas pares —
   * usado en dibujarFormulario104() para imitar el bandeado alternado de
   * la tabla real de "Resumen de Ventas"/"Resumen de Adquisiciones".
   */
  private filaCasillero(
    documento: PDFKit.PDFDocument,
    y: number,
    etiquetaCruda: string,
    valor: string,
    zebra = false,
  ): number {
    const { numero, texto, esTotal } = this.parsearEtiqueta(etiquetaCruda);

    documento.fontSize(7.5);
    const alturaTexto = documento.heightOfString(texto, { width: COL_ETQ_W - 8 });
    const alto = Math.max(alturaTexto + 6, 16);

    if (esTotal) {
      documento.rect(MARGEN, y, ANCHO_UTIL, alto).fill(AMBAR);
    } else if (zebra) {
      documento.rect(MARGEN, y, ANCHO_UTIL, alto).fill('#f3f4f6');
    }
    if (!esTotal && numero) {
      documento.rect(COL_NUM_X, y, COL_NUM_W, alto).fill('#dbeafe');
    }
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).strokeColor(GRIS_BORDE).lineWidth(0.5).stroke();
    documento.moveTo(COL_NUM_X, y).lineTo(COL_NUM_X, y + alto).strokeColor(GRIS_BORDE).stroke();
    documento.moveTo(COL_VAL_X, y).lineTo(COL_VAL_X, y + alto).strokeColor(GRIS_BORDE).stroke();

    documento
      .fillColor('#111827')
      .font(esTotal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7.5)
      .text(texto, COL_ETQ_X + 4, y + 3, { width: COL_ETQ_W - 8 });
    documento.text(numero, COL_NUM_X + 2, y + 3, { width: COL_NUM_W - 4, align: 'center' });
    documento
      .font('Courier' + (esTotal ? '-Bold' : ''))
      .fontSize(8)
      .text(valor, COL_VAL_X + 4, y + 3, { width: COL_VAL_W - 8, align: 'right' });
    documento.font('Helvetica');

    return y + alto;
  }

  /** Recuadro destacado con el resultado final (valor a pagar / a favor). */
  private filaResultado(documento: PDFKit.PDFDocument, y: number, etiqueta: string, valor: string): number {
    const alto = 24;
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).fill('#eff6ff');
    documento.rect(MARGEN, y, ANCHO_UTIL, alto).strokeColor(AZUL_SRI).lineWidth(1).stroke();
    documento
      .fillColor('#1e3a5f')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(etiqueta, MARGEN + 10, y + 8, { width: ANCHO_UTIL - 180 });
    documento
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(AZUL_SRI)
      .text(valor, MARGEN + 10, y + 6, { width: ANCHO_UTIL - 20, align: 'right' });
    documento.font('Helvetica').fillColor('#000000');
    return y + alto + 8;
  }

  private parsearEtiqueta(etiqueta: string): FilaParseada {
    const match = etiqueta.match(/^Casillero(?:s)?\s+([\d-]+)\s*·\s*(.+)$/i);
    const texto = match ? match[2] : etiqueta;
    const numero = match ? match[1] : '';
    const esTotal = /base imponible|ingresos gravados con este empleador/i.test(texto);
    return { numero, texto, esTotal };
  }

  private verificarSaltoDePagina(documento: PDFKit.PDFDocument, y: number, espacioNecesario: number): number {
    const alturaPagina = documento.page.height - MARGEN;
    if (y + espacioNecesario > alturaPagina) {
      documento.addPage();
      return MARGEN;
    }
    return y;
  }

  /**
   * Pie de página: el aviso de "documento no oficial" siempre se muestra,
   * destacado en un recuadro rojo (además del aviso corto ya visible junto
   * al título en dibujarFormulario107()). Para el 107 se agregan además las
   * instrucciones numeradas del formulario oficial del SRI.
   */
  private pieAviso(documento: PDFKit.PDFDocument, y: number, incluirNotasSri: boolean): void {
    y = this.verificarSaltoDePagina(documento, y, 50);

    const alturaAviso = 32;
    documento.rect(MARGEN, y, ANCHO_UTIL, alturaAviso).fill('#fef2f2');
    documento.rect(MARGEN, y, ANCHO_UTIL, alturaAviso).strokeColor('#ef4444').lineWidth(0.75).stroke();
    documento
      .fontSize(7)
      .font('Helvetica-Bold')
      .fillColor('#991b1b')
      .text(
        'Documento informativo generado por Sistema Fintech a partir de tus propios datos. No constituye una ' +
          'declaración presentada ante el Servicio de Rentas Internas (SRI). Verifica los casilleros y montos en ' +
          'el formulario vigente en sri.gob.ec antes de presentar tu declaración real.',
        MARGEN + 8,
        y + 6,
        { width: ANCHO_UTIL - 16 },
      );
    documento.font('Helvetica').fillColor('#000000');
    y += alturaAviso + 10;

    if (!incluirNotasSri) {
      return;
    }

    y = this.verificarSaltoDePagina(documento, y, 100);
    documento
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor('#374151')
      .text('Instrucciones', MARGEN, y, { width: ANCHO_UTIL });
    documento.font('Helvetica');
    y = documento.y + 3;

    const instrucciones = [
      '1. Si durante el período reinició su actividad laboral con otro empleador, deberá presentarse un formulario 107 por cada empleador.',
      '2. El casillero 307 corresponde al valor del impuesto a la renta causado, calculado según la tabla vigente del ejercicio fiscal.',
      '3. Los gastos personales deducibles (casillero 311 y siguientes) se consideran únicamente si fueron proyectados y comunicados al empleador conforme a la normativa del SRI.',
      '4. Si el trabajador tiene 65 años de edad o más, aplica la exoneración de tercera edad sobre la fracción básica correspondiente.',
      '5. Si el trabajador tiene una discapacidad certificada por el CONADIS, aplica la exoneración por discapacidad según el porcentaje calificado.',
      '6. Las exoneraciones de tercera edad y de discapacidad no son simultáneas: se aplica la que resulte más beneficiosa para el contribuyente.',
      '7. Si el contribuyente percibió ingresos de dos o más empleadores en relación de dependencia, está obligado a presentar su declaración anual del Impuesto a la Renta.',
      '8. La rebaja de gastos personales está sujeta al límite anual establecido por el SRI para el ejercicio fiscal y no puede superar el total del ingreso gravado.',
    ];

    documento.fontSize(6.5).fillColor('#6b7280');
    for (const linea of instrucciones) {
      y = this.verificarSaltoDePagina(documento, y, 16);
      documento.text(linea, MARGEN, y, { width: ANCHO_UTIL, align: 'left' });
      y = documento.y + 3;
    }
    documento.fillColor('#000000');
  }

  /** Fecha actual en formato DD-MM-AAAA, igual al que usa el SRI en "Fecha de entrega". */
  private fechaHoyLegible(): string {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, '0');
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${hoy.getFullYear()}`;
  }
}
