import { BadRequestException, Injectable } from '@nestjs/common';

import type { TipoMovimiento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

// Ecuador continental utiliza UTC-5.
const DESFASE_HORARIO_APLICACION = '-05:00';

// Tipos de reporte utilizados solamente dentro del backend.
// No se guardan en PostgreSQL.
export type TipoReporte = 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'ANUAL';

type EstadoFinanciero = 'SUPERAVIT' | 'EQUILIBRIO' | 'DEFICIT';

// Prisma Decimal contiene este método.
// Solo declaramos lo que Reportes necesita utilizar.
type MontoPrisma = {
  toFixed(decimales: number): string;
};

// Forma de cada movimiento obtenido desde Prisma.
type MovimientoConsultado = {
  id: number;
  tipo: TipoMovimiento;
  monto: MontoPrisma;
  descripcion: string | null;
  fecha: Date;
  categoria: {
    id: number;
    nombre: string;
  };
};

type PeriodoCalculado = {
  fechaDesde: Date;
  fechaHasta: Date;
  inicioConsulta: Date;
  finConsultaExclusivo: Date;
};

type PuntoPeriodo = {
  orden: number;
  etiqueta: string;
  fechaDesde: Date;
  fechaHasta: Date;
};

type TotalesCalculados = {
  ingresosCentavos: number;
  gastosCentavos: number;
  cantidadIngresos: number;
  cantidadGastos: number;
};

type CategoriaAcumulada = {
  categoriaId: number;
  nombre: string;
  montoCentavos: number;
  cantidadMovimientos: number;
};

// Estructura exacta que recibirán Angular, PDF y Excel.
// Se mantiene en este archivo para evitar una carpeta de interfaces.
export type ResultadoReporte = {
  tipo: TipoReporte;

  periodo: {
    fechaDesde: string;
    fechaHasta: string;
  };

  resumen: {
    ingresos: string;
    gastos: string;
    balance: string;
    porcentajeAhorro: number;
    estado: EstadoFinanciero;
    cantidadIngresos: number;
    cantidadGastos: number;
    totalMovimientos: number;
  };

  categorias: {
    ingresos: {
      categoriaId: number;
      nombre: string;
      monto: string;
      porcentaje: number;
      cantidadMovimientos: number;
    }[];

    gastos: {
      categoriaId: number;
      nombre: string;
      monto: string;
      porcentaje: number;
      cantidadMovimientos: number;
    }[];
  };

  evolucion: {
    orden: number;
    etiqueta: string;

    periodo: {
      fechaDesde: string;
      fechaHasta: string;
    };

    ingresos: string;
    gastos: string;
    balance: string;
    cantidadMovimientos: number;
  }[];

  movimientos: {
    id: number;
    tipo: TipoMovimiento;
    monto: string;
    descripcion: string | null;
    fecha: string;

    categoria: {
      id: number;
      nombre: string;
    };
  }[];
};

@Injectable()
export class ReportesService {
  constructor(private readonly prismaService: PrismaService) {}

  // Genera cualquiera de los cuatro tipos de reporte.
  async obtenerReporte(
    usuarioId: number,
    tipoReporte: TipoReporte,
    fechaReferencia?: string,
  ): Promise<ResultadoReporte> {
    const periodo = this.calcularPeriodo(tipoReporte, fechaReferencia);

    const movimientos = await this.prismaService.movimiento.findMany({
      where: {
        // Garantiza que el usuario consulte solamente sus datos.
        usuarioId,

        // Excluye movimientos eliminados lógicamente.
        eliminadoEn: null,

        fecha: {
          // Incluye el primer instante del período.
          gte: periodo.inicioConsulta,

          // Excluye el primer instante del día posterior.
          lt: periodo.finConsultaExclusivo,
        },
      },
      orderBy: [
        {
          fecha: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: {
        id: true,
        tipo: true,
        monto: true,
        descripcion: true,
        fecha: true,

        categoria: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    return {
      tipo: tipoReporte,

      periodo: {
        fechaDesde: this.formatearFecha(periodo.fechaDesde),
        fechaHasta: this.formatearFecha(periodo.fechaHasta),
      },

      resumen: this.construirResumen(movimientos),

      categorias: this.construirCategorias(movimientos),

      evolucion: this.construirEvolucion(tipoReporte, periodo, movimientos),

      movimientos: movimientos.map((movimiento) => ({
        id: movimiento.id,
        tipo: movimiento.tipo,
        monto: movimiento.monto.toFixed(2),
        descripcion: movimiento.descripcion,
        fecha: this.obtenerFechaEcuador(movimiento.fecha),
        categoria: movimiento.categoria,
      })),
    };
  }

  // Determina qué cálculo de fechas debe utilizar.
  private calcularPeriodo(
    tipoReporte: TipoReporte,
    fechaReferencia?: string,
  ): PeriodoCalculado {
    const fecha = fechaReferencia
      ? this.convertirFechaReferencia(fechaReferencia)
      : this.obtenerFechaActualEcuador();

    if (tipoReporte === 'DIARIO') {
      return this.calcularPeriodoDiario(fecha);
    }

    if (tipoReporte === 'SEMANAL') {
      return this.calcularPeriodoSemanal(fecha);
    }

    if (tipoReporte === 'MENSUAL') {
      return this.calcularPeriodoMensual(fecha);
    }

    return this.calcularPeriodoAnual(fecha);
  }

  // Calcula una semana completa de lunes a domingo.
  private calcularPeriodoSemanal(fechaReferencia: Date): PeriodoCalculado {
    // Domingo es 0, lunes es 1 y sábado es 6.
    const diaSemana = fechaReferencia.getUTCDay();

    const diasDesdeLunes = (diaSemana + 6) % 7;

    const fechaDesde = this.sumarDias(fechaReferencia, -diasDesdeLunes);

    const fechaHasta = this.sumarDias(fechaDesde, 6);

    return this.crearPeriodo(fechaDesde, fechaHasta);
  }

  // Calcula el primer y último día del mes.
  private calcularPeriodoMensual(fechaReferencia: Date): PeriodoCalculado {
    const anio = fechaReferencia.getUTCFullYear();

    const mes = fechaReferencia.getUTCMonth();

    const fechaDesde = new Date(Date.UTC(anio, mes, 1));

    // El día cero del mes siguiente es el
    // último día del mes seleccionado.
    const fechaHasta = new Date(Date.UTC(anio, mes + 1, 0));

    return this.crearPeriodo(fechaDesde, fechaHasta);
  }

  // Calcula un año completo.
  private calcularPeriodoAnual(fechaReferencia: Date): PeriodoCalculado {
    const anio = fechaReferencia.getUTCFullYear();

    const fechaDesde = new Date(Date.UTC(anio, 0, 1));

    const fechaHasta = new Date(Date.UTC(anio, 11, 31));

    return this.crearPeriodo(fechaDesde, fechaHasta);
  }

  // Calcula un único día completo según la fecha seleccionada.
  private calcularPeriodoDiario(fechaReferencia: Date): PeriodoCalculado {
    return this.crearPeriodo(fechaReferencia, fechaReferencia);
  }

  // Construye las fechas visibles y las fechas
  // exactas que utilizará Prisma.
  private crearPeriodo(fechaDesde: Date, fechaHasta: Date): PeriodoCalculado {
    const diaPosterior = this.sumarDias(fechaHasta, 1);

    return {
      fechaDesde,
      fechaHasta,

      inicioConsulta: this.convertirInicioDiaEcuador(fechaDesde),

      finConsultaExclusivo: this.convertirInicioDiaEcuador(diaPosterior),
    };
  }

  // Calcula los totales principales.
  private construirResumen(
    movimientos: MovimientoConsultado[],
  ): ResultadoReporte['resumen'] {
    const totales = this.calcularTotales(movimientos);

    const balanceCentavos = totales.ingresosCentavos - totales.gastosCentavos;

    const porcentajeAhorro =
      totales.ingresosCentavos > 0
        ? Number(
            ((balanceCentavos / totales.ingresosCentavos) * 100).toFixed(2),
          )
        : 0;

    let estado: EstadoFinanciero = 'EQUILIBRIO';

    if (balanceCentavos > 0) {
      estado = 'SUPERAVIT';
    }

    if (balanceCentavos < 0) {
      estado = 'DEFICIT';
    }

    return {
      ingresos: this.formatearCentavos(totales.ingresosCentavos),

      gastos: this.formatearCentavos(totales.gastosCentavos),

      balance: this.formatearCentavos(balanceCentavos),

      porcentajeAhorro,
      estado,

      cantidadIngresos: totales.cantidadIngresos,

      cantidadGastos: totales.cantidadGastos,

      totalMovimientos: movimientos.length,
    };
  }

  // Agrupa los ingresos y gastos por categoría.
  private construirCategorias(
    movimientos: MovimientoConsultado[],
  ): ResultadoReporte['categorias'] {
    const ingresos = new Map<number, CategoriaAcumulada>();

    const gastos = new Map<number, CategoriaAcumulada>();

    for (const movimiento of movimientos) {
      const mapa = movimiento.tipo === 'INGRESO' ? ingresos : gastos;

      const montoCentavos = this.convertirMontoACentavos(movimiento.monto);

      const categoriaActual = mapa.get(movimiento.categoria.id);

      if (categoriaActual) {
        categoriaActual.montoCentavos += montoCentavos;

        categoriaActual.cantidadMovimientos += 1;

        continue;
      }

      mapa.set(movimiento.categoria.id, {
        categoriaId: movimiento.categoria.id,

        nombre: movimiento.categoria.nombre,

        montoCentavos,

        cantidadMovimientos: 1,
      });
    }

    const totalIngresos = this.sumarCategorias(ingresos);

    const totalGastos = this.sumarCategorias(gastos);

    return {
      ingresos: this.convertirCategorias(ingresos, totalIngresos),

      gastos: this.convertirCategorias(gastos, totalGastos),
    };
  }

  // Convierte los mapas internos en la respuesta final.
  private convertirCategorias(
    categorias: Map<number, CategoriaAcumulada>,
    totalCentavos: number,
  ): ResultadoReporte['categorias']['ingresos'] {
    return Array.from(categorias.values())
      .sort(
        (categoriaA, categoriaB) =>
          categoriaB.montoCentavos - categoriaA.montoCentavos,
      )
      .map((categoria) => ({
        categoriaId: categoria.categoriaId,
        nombre: categoria.nombre,

        monto: this.formatearCentavos(categoria.montoCentavos),

        porcentaje:
          totalCentavos > 0
            ? Number(
                ((categoria.montoCentavos / totalCentavos) * 100).toFixed(2),
              )
            : 0,

        cantidadMovimientos: categoria.cantidadMovimientos,
      }));
  }

  // Construye los puntos utilizados por los gráficos.
  private construirEvolucion(
    tipoReporte: TipoReporte,
    periodo: PeriodoCalculado,
    movimientos: MovimientoConsultado[],
  ): ResultadoReporte['evolucion'] {
    const puntos = this.crearPuntosPeriodo(tipoReporte, periodo);

    return puntos.map((punto) => {
      const fechaDesde = this.formatearFecha(punto.fechaDesde);

      const fechaHasta = this.formatearFecha(punto.fechaHasta);

      const movimientosDelPunto = movimientos.filter((movimiento) => {
        const fechaMovimiento = this.obtenerFechaEcuador(movimiento.fecha);

        return fechaMovimiento >= fechaDesde && fechaMovimiento <= fechaHasta;
      });

      const totales = this.calcularTotales(movimientosDelPunto);

      const balanceCentavos = totales.ingresosCentavos - totales.gastosCentavos;

      return {
        orden: punto.orden,
        etiqueta: punto.etiqueta,

        periodo: {
          fechaDesde,
          fechaHasta,
        },

        ingresos: this.formatearCentavos(totales.ingresosCentavos),

        gastos: this.formatearCentavos(totales.gastosCentavos),

        balance: this.formatearCentavos(balanceCentavos),

        cantidadMovimientos: movimientosDelPunto.length,
      };
    });
  }

  // Decide si cada punto representa un día,
  // una semana o un mes.
  private crearPuntosPeriodo(
    tipoReporte: TipoReporte,
    periodo: PeriodoCalculado,
  ): PuntoPeriodo[] {
    if (tipoReporte === 'DIARIO') {
      return this.crearPuntosDiarios(periodo);
    }

    if (tipoReporte === 'SEMANAL') {
      return this.crearPuntosSemanales(periodo);
    }

    if (tipoReporte === 'MENSUAL') {
      return this.crearPuntosMensuales(periodo);
    }

    return this.crearPuntosAnuales(periodo);
  }

  // En el reporte diario se genera un punto
  // que representa el total del día.
  private crearPuntosDiarios(periodo: PeriodoCalculado): PuntoPeriodo[] {
    return [
      {
        orden: 1,
        etiqueta: 'Total del día',
        fechaDesde: periodo.fechaDesde,
        fechaHasta: periodo.fechaHasta,
      },
    ];
  }

  // En el reporte semanal, cada punto es un día.
  private crearPuntosSemanales(periodo: PeriodoCalculado): PuntoPeriodo[] {
    const nombresDias = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];

    const puntos: PuntoPeriodo[] = [];

    for (let indice = 0; indice < 7; indice += 1) {
      const fecha = this.sumarDias(periodo.fechaDesde, indice);

      puntos.push({
        orden: indice + 1,
        etiqueta: nombresDias[fecha.getUTCDay()],
        fechaDesde: fecha,
        fechaHasta: fecha,
      });
    }

    return puntos;
  }

  // En el reporte mensual, cada punto representa
  // una semana del calendario.
  private crearPuntosMensuales(periodo: PeriodoCalculado): PuntoPeriodo[] {
    const puntos: PuntoPeriodo[] = [];

    let fechaInicial = new Date(periodo.fechaDesde);

    let numeroSemana = 1;

    while (fechaInicial.getTime() <= periodo.fechaHasta.getTime()) {
      const diasHastaDomingo = (7 - fechaInicial.getUTCDay()) % 7;

      let fechaFinal = this.sumarDias(fechaInicial, diasHastaDomingo);

      if (fechaFinal.getTime() > periodo.fechaHasta.getTime()) {
        fechaFinal = new Date(periodo.fechaHasta);
      }

      puntos.push({
        orden: numeroSemana,
        etiqueta: `Semana ${numeroSemana}`,
        fechaDesde: fechaInicial,
        fechaHasta: fechaFinal,
      });

      fechaInicial = this.sumarDias(fechaFinal, 1);

      numeroSemana += 1;
    }

    return puntos;
  }

  // En el reporte anual, cada punto es un mes.
  private crearPuntosAnuales(periodo: PeriodoCalculado): PuntoPeriodo[] {
    const nombresMeses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    const anio = periodo.fechaDesde.getUTCFullYear();

    return nombresMeses.map((nombreMes, indice) => ({
      orden: indice + 1,
      etiqueta: nombreMes,

      fechaDesde: new Date(Date.UTC(anio, indice, 1)),

      fechaHasta: new Date(Date.UTC(anio, indice + 1, 0)),
    }));
  }

  // Suma ingresos, gastos y cantidades.
  private calcularTotales(
    movimientos: MovimientoConsultado[],
  ): TotalesCalculados {
    let ingresosCentavos = 0;
    let gastosCentavos = 0;
    let cantidadIngresos = 0;
    let cantidadGastos = 0;

    for (const movimiento of movimientos) {
      const montoCentavos = this.convertirMontoACentavos(movimiento.monto);

      if (movimiento.tipo === 'INGRESO') {
        ingresosCentavos += montoCentavos;
        cantidadIngresos += 1;
      } else {
        gastosCentavos += montoCentavos;
        cantidadGastos += 1;
      }
    }

    return {
      ingresosCentavos,
      gastosCentavos,
      cantidadIngresos,
      cantidadGastos,
    };
  }

  private sumarCategorias(categorias: Map<number, CategoriaAcumulada>): number {
    return Array.from(categorias.values()).reduce(
      (total, categoria) => total + categoria.montoCentavos,
      0,
    );
  }

  // Convierte Decimal a centavos para evitar errores
  // de precisión al sumar dinero.
  private convertirMontoACentavos(monto: MontoPrisma): number {
    const texto = monto.toFixed(2);

    const esNegativo = texto.startsWith('-');

    const textoSinSigno = esNegativo ? texto.slice(1) : texto;

    const [parteEntera, parteDecimal = '00'] = textoSinSigno.split('.');

    const centavos = Number(parteEntera) * 100 + Number(parteDecimal);

    return esNegativo ? -centavos : centavos;
  }

  // Convierte centavos a un texto como 150.25.
  private formatearCentavos(centavos: number): string {
    const esNegativo = centavos < 0;
    const valorAbsoluto = Math.abs(centavos);

    const parteEntera = Math.floor(valorAbsoluto / 100);

    const parteDecimal = String(valorAbsoluto % 100).padStart(2, '0');

    return `${esNegativo ? '-' : ''}${parteEntera}.${parteDecimal}`;
  }

  // Comprueba que la fecha exista realmente.
  private convertirFechaReferencia(fecha: string): Date {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

    if (!coincidencia) {
      throw new BadRequestException(
        'fechaReferencia debe tener el formato YYYY-MM-DD',
      );
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);

    if (anio < 2000 || anio > 2100) {
      throw new BadRequestException('El año debe estar entre 2000 y 2100');
    }

    const fechaConvertida = new Date(Date.UTC(anio, mes - 1, dia));

    const fechaEsValida =
      fechaConvertida.getUTCFullYear() === anio &&
      fechaConvertida.getUTCMonth() === mes - 1 &&
      fechaConvertida.getUTCDate() === dia;

    if (!fechaEsValida) {
      throw new BadRequestException(
        'fechaReferencia no representa una fecha válida',
      );
    }

    return fechaConvertida;
  }

  // Obtiene la fecha actual según Ecuador,
  // aunque el servidor use otra zona horaria.
  private obtenerFechaActualEcuador(): Date {
    const fechaTexto = this.obtenerFechaEcuador(new Date());

    return this.convertirFechaReferencia(fechaTexto);
  }

  // Convierte un instante a la fecha correspondiente
  // en Ecuador.
  private obtenerFechaEcuador(fecha: Date): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(fecha);

    const anio = partes.find((parte) => parte.type === 'year')?.value;

    const mes = partes.find((parte) => parte.type === 'month')?.value;

    const dia = partes.find((parte) => parte.type === 'day')?.value;

    if (!anio || !mes || !dia) {
      throw new Error('No fue posible calcular la fecha de Ecuador');
    }

    return `${anio}-${mes}-${dia}`;
  }

  private convertirInicioDiaEcuador(fecha: Date): Date {
    return new Date(
      `${this.formatearFecha(fecha)}T00:00:00.000${DESFASE_HORARIO_APLICACION}`,
    );
  }

  private sumarDias(fecha: Date, cantidadDias: number): Date {
    const resultado = new Date(fecha);

    resultado.setUTCDate(resultado.getUTCDate() + cantidadDias);

    return resultado;
  }

  private formatearFecha(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}
