import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import type { ResultadoReporte } from './reportes.service';

export type ArchivoReporte = {
  contenido: Buffer;
  tipoMime: string;
  extension: 'pdf' | 'xlsx';
};

@Injectable()
export class ReportesExportacionService {
  // Decide qué tipo de archivo debe generarse.
  async generarArchivo(
    reporte: ResultadoReporte,
    formato: 'pdf' | 'excel',
  ): Promise<ArchivoReporte> {
    if (formato === 'pdf') {
      return {
        contenido: await this.generarPdf(reporte),

        tipoMime: 'application/pdf',

        extension: 'pdf',
      };
    }

    return {
      contenido: await this.generarExcel(reporte),

      tipoMime:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      extension: 'xlsx',
    };
  }

  // Genera el documento PDF en memoria.
  private generarPdf(reporte: ResultadoReporte): Promise<Buffer> {
    const documento = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Reporte financiero ${reporte.tipo}`,
        Author: 'Sistema Fintech',
      },
    });

    const fragmentos: Buffer[] = [];

    return new Promise<Buffer>((resolver, rechazar) => {
      documento.on('data', (fragmento: Buffer) => {
        fragmentos.push(fragmento);
      });

      documento.on('end', () => {
        resolver(Buffer.concat(fragmentos));
      });

      documento.on('error', (error: Error) => {
        rechazar(error);
      });

      documento.fontSize(20).fillColor('#166534').text('Reporte financiero', {
        align: 'center',
      });

      documento
        .fontSize(12)
        .fillColor('#000000')
        .text(`Tipo: ${reporte.tipo}`, {
          align: 'center',
        });

      documento.text(
        `Período: ${reporte.periodo.fechaDesde} al ${reporte.periodo.fechaHasta}`,
        {
          align: 'center',
        },
      );

      documento.moveDown(2);

      documento.fontSize(15).fillColor('#166534').text('Resumen');

      documento.fontSize(11).fillColor('#000000');

      documento.text(
        `Ingresos: ${this.formatearDinero(reporte.resumen.ingresos)}`,
      );

      documento.text(`Gastos: ${this.formatearDinero(reporte.resumen.gastos)}`);

      documento.text(
        `Balance: ${this.formatearDinero(reporte.resumen.balance)}`,
      );

      documento.text(
        `Porcentaje de ahorro: ${reporte.resumen.porcentajeAhorro}%`,
      );

      documento.text(`Estado financiero: ${reporte.resumen.estado}`);

      documento.text(
        `Cantidad de ingresos: ${reporte.resumen.cantidadIngresos}`,
      );

      documento.text(`Cantidad de gastos: ${reporte.resumen.cantidadGastos}`);

      documento.text(
        `Total de movimientos: ${reporte.resumen.totalMovimientos}`,
      );

      documento.moveDown();

      documento
        .fontSize(15)
        .fillColor('#166534')
        .text('Categorías de ingresos');

      documento.fontSize(10).fillColor('#000000');

      if (reporte.categorias.ingresos.length === 0) {
        documento.text('No existen ingresos en este período.');
      }

      for (const categoria of reporte.categorias.ingresos) {
        documento.text(
          `${categoria.nombre}: ${this.formatearDinero(
            categoria.monto,
          )} - ${categoria.porcentaje}% - ${categoria.cantidadMovimientos} movimiento(s)`,
        );
      }

      documento.moveDown();

      documento.fontSize(15).fillColor('#166534').text('Categorías de gastos');

      documento.fontSize(10).fillColor('#000000');

      if (reporte.categorias.gastos.length === 0) {
        documento.text('No existen gastos en este período.');
      }

      for (const categoria of reporte.categorias.gastos) {
        documento.text(
          `${categoria.nombre}: ${this.formatearDinero(
            categoria.monto,
          )} - ${categoria.porcentaje}% - ${categoria.cantidadMovimientos} movimiento(s)`,
        );
      }

      documento.moveDown();

      documento.fontSize(15).fillColor('#166534').text('Evolución financiera');

      documento.fontSize(10).fillColor('#000000');

      for (const punto of reporte.evolucion) {
        documento.text(
          `${punto.etiqueta} (${punto.periodo.fechaDesde} al ${punto.periodo.fechaHasta})`,
        );

        documento.text(
          `Ingresos: ${this.formatearDinero(
            punto.ingresos,
          )} | Gastos: ${this.formatearDinero(
            punto.gastos,
          )} | Balance: ${this.formatearDinero(punto.balance)}`,
        );

        documento.moveDown(0.5);
      }

      documento.moveDown();

      documento
        .fontSize(15)
        .fillColor('#166534')
        .text('Detalle de movimientos');

      documento.fontSize(10).fillColor('#000000');

      if (reporte.movimientos.length === 0) {
        documento.text('No existen movimientos en este período.');
      }

      for (const movimiento of reporte.movimientos) {
        documento.text(
          `${movimiento.fecha} | ${movimiento.tipo} | ${movimiento.categoria.nombre} | ${this.formatearDinero(
            movimiento.monto,
          )}`,
        );

        documento.text(
          `Descripción: ${movimiento.descripcion ?? 'Sin descripción'}`,
        );

        documento.moveDown(0.5);
      }

      documento.end();
    });
  }

  // Genera el libro Excel en memoria.
  private async generarExcel(reporte: ResultadoReporte): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();

    libro.creator = 'Sistema Fintech';
    libro.created = new Date();

    this.crearHojaResumen(libro, reporte);
    this.crearHojaCategorias(libro, reporte);
    this.crearHojaEvolucion(libro, reporte);
    this.crearHojaMovimientos(libro, reporte);

    const contenido = await libro.xlsx.writeBuffer();

    return Buffer.from(contenido);
  }

  private crearHojaResumen(
    libro: ExcelJS.Workbook,
    reporte: ResultadoReporte,
  ): void {
    const hoja = libro.addWorksheet('Resumen');

    hoja.columns = [
      {
        key: 'campo',
        width: 30,
      },
      {
        key: 'valor',
        width: 25,
      },
    ];

    hoja.addRow(['Campo', 'Valor']);
    hoja.addRow(['Tipo', reporte.tipo]);
    hoja.addRow(['Fecha desde', reporte.periodo.fechaDesde]);
    hoja.addRow(['Fecha hasta', reporte.periodo.fechaHasta]);
    hoja.addRow(['Ingresos', Number(reporte.resumen.ingresos)]);
    hoja.addRow(['Gastos', Number(reporte.resumen.gastos)]);
    hoja.addRow(['Balance', Number(reporte.resumen.balance)]);
    hoja.addRow([
      'Porcentaje de ahorro',
      reporte.resumen.porcentajeAhorro / 100,
    ]);
    hoja.addRow(['Estado financiero', reporte.resumen.estado]);
    hoja.addRow(['Cantidad de ingresos', reporte.resumen.cantidadIngresos]);
    hoja.addRow(['Cantidad de gastos', reporte.resumen.cantidadGastos]);
    hoja.addRow(['Total de movimientos', reporte.resumen.totalMovimientos]);

    this.aplicarEstiloEncabezado(hoja);

    hoja.getCell('B5').numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getCell('B6').numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getCell('B7').numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getCell('B8').numFmt = '0.00%';
  }

  private crearHojaCategorias(
    libro: ExcelJS.Workbook,
    reporte: ResultadoReporte,
  ): void {
    const hoja = libro.addWorksheet('Categorías');

    hoja.columns = [
      {
        key: 'tipo',
        width: 15,
      },
      {
        key: 'categoria',
        width: 30,
      },
      {
        key: 'monto',
        width: 18,
      },
      {
        key: 'porcentaje',
        width: 18,
      },
      {
        key: 'cantidad',
        width: 22,
      },
    ];

    hoja.addRow([
      'Tipo',
      'Categoría',
      'Monto',
      'Porcentaje',
      'Cantidad de movimientos',
    ]);

    for (const categoria of reporte.categorias.ingresos) {
      hoja.addRow([
        'INGRESO',
        categoria.nombre,
        Number(categoria.monto),
        categoria.porcentaje / 100,
        categoria.cantidadMovimientos,
      ]);
    }

    for (const categoria of reporte.categorias.gastos) {
      hoja.addRow([
        'GASTO',
        categoria.nombre,
        Number(categoria.monto),
        categoria.porcentaje / 100,
        categoria.cantidadMovimientos,
      ]);
    }

    this.aplicarEstiloEncabezado(hoja);

    hoja.getColumn(3).numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getColumn(4).numFmt = '0.00%';
  }

  private crearHojaEvolucion(
    libro: ExcelJS.Workbook,
    reporte: ResultadoReporte,
  ): void {
    const hoja = libro.addWorksheet('Evolución');

    hoja.columns = [
      {
        key: 'periodo',
        width: 20,
      },
      {
        key: 'desde',
        width: 15,
      },
      {
        key: 'hasta',
        width: 15,
      },
      {
        key: 'ingresos',
        width: 18,
      },
      {
        key: 'gastos',
        width: 18,
      },
      {
        key: 'balance',
        width: 18,
      },
      {
        key: 'cantidad',
        width: 22,
      },
    ];

    hoja.addRow([
      'Período',
      'Fecha desde',
      'Fecha hasta',
      'Ingresos',
      'Gastos',
      'Balance',
      'Cantidad de movimientos',
    ]);

    for (const punto of reporte.evolucion) {
      hoja.addRow([
        punto.etiqueta,
        punto.periodo.fechaDesde,
        punto.periodo.fechaHasta,
        Number(punto.ingresos),
        Number(punto.gastos),
        Number(punto.balance),
        punto.cantidadMovimientos,
      ]);
    }

    this.aplicarEstiloEncabezado(hoja);

    hoja.getColumn(4).numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getColumn(5).numFmt = '$#,##0.00;[Red]-$#,##0.00';

    hoja.getColumn(6).numFmt = '$#,##0.00;[Red]-$#,##0.00';
  }

  private crearHojaMovimientos(
    libro: ExcelJS.Workbook,
    reporte: ResultadoReporte,
  ): void {
    const hoja = libro.addWorksheet('Movimientos');

    hoja.columns = [
      {
        key: 'id',
        width: 10,
      },
      {
        key: 'fecha',
        width: 15,
      },
      {
        key: 'tipo',
        width: 15,
      },
      {
        key: 'monto',
        width: 18,
      },
      {
        key: 'categoria',
        width: 25,
      },
      {
        key: 'descripcion',
        width: 45,
      },
    ];

    hoja.addRow(['ID', 'Fecha', 'Tipo', 'Monto', 'Categoría', 'Descripción']);

    for (const movimiento of reporte.movimientos) {
      hoja.addRow([
        movimiento.id,
        movimiento.fecha,
        movimiento.tipo,
        Number(movimiento.monto),
        movimiento.categoria.nombre,
        movimiento.descripcion ?? 'Sin descripción',
      ]);
    }

    this.aplicarEstiloEncabezado(hoja);

    hoja.getColumn(4).numFmt = '$#,##0.00;[Red]-$#,##0.00';
  }

  private aplicarEstiloEncabezado(hoja: ExcelJS.Worksheet): void {
    const encabezado = hoja.getRow(1);

    encabezado.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF',
      },
    };

    encabezado.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF166534',
      },
    };

    encabezado.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    encabezado.height = 24;

    hoja.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];
  }

  private formatearDinero(monto: string): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(monto));
  }
}
