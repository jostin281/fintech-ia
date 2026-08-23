import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MetasAhorroService } from '../metas-ahorro/metas-ahorro.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConocimientoAsistenteService } from './conocimiento-asistente.service';
import { CrearConversacionDto } from './dto/crear-conversacion.dto';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { GeminiService } from './gemini.service';

type EstadoPresupuestoMensual =
  | 'SIN_CONSUMO'
  | 'DENTRO_DEL_LIMITE'
  | 'EN_ALERTA'
  | 'LIMITE_ALCANZADO'
  | 'EXCEDIDO';

type ContextoPresupuestosMensuales = {
  periodo: {
    mes: number;
    anio: number;
  };
  total: number;
  resumen: {
    montoPresupuestado: string;
    montoGastado: string;
    saldoDisponible: string;
    porcentajeUtilizado: number;
    presupuestosEnAlerta: number;
    presupuestosExcedidos: number;
  };
  presupuestos: Array<{
    id: number;
    montoLimite: string;
    montoGastado: string;
    saldoDisponible: string;
    porcentajeUtilizado: number;
    porcentajeAlerta: number;
    estado: EstadoPresupuestoMensual;
    categoria: {
      id: number;
      nombre: string;
    };
  }>;
};

type EstadoMetaAhorro =
  'SIN_APORTES' | 'EN_PROGRESO' | 'COMPLETADA' | 'VENCIDA';

type ContextoMetasAhorro = {
  total: number;
  resumen: {
    montoObjetivoTotal: string;
    montoAhorradoTotal: string;
    porcentajeAhorroGeneral: number;
    metasSinAportes: number;
    metasEnProgreso: number;
    metasCompletadas: number;
    metasVencidas: number;
  };
  metas: Array<{
    id: number;
    nombre: string;
    montoObjetivo: string;
    montoAhorrado: string;
    montoRestante: string;
    porcentajeAvance: number;
    estado: EstadoMetaAhorro;
    fechaObjetivo: string;
    diasRestantes: number;
    activo: boolean;
  }>;
};

type ContextoFinanciero = {
  periodo: {
    tipo: TipoPeriodoConsulta;
    descripcion: string;
    fechaDesde: string;
    fechaHasta: string;
    mes: number | null;
    anio: number;
    incluyeFechaActual: boolean;
  };
  resumen: {
    totalIngresos: string;
    totalGastos: string;
    saldo: string;
    cantidadMovimientos: number;
  };
  categoriaMayorGasto: {
    id: number;
    nombre: string;
    totalGastado: string;
  } | null;
  presupuestos: ContextoPresupuestosMensuales;
  metasAhorro: ContextoMetasAhorro;
};

type TipoRecomendacionLocal = 'AHORRAR' | 'REDUCIR_GASTOS';

type TipoPeriodoConsulta = 'DIA' | 'SEMANA' | 'MES' | 'ANIO' | 'RANGO';

type PeriodoConsulta = ContextoFinanciero['periodo'] & {
  fechaDesdeUtc: Date;
  fechaHastaUtcExclusiva: Date;
};

type FechaCalendario = {
  anio: number;
  indiceMes: number;
  dia: number;
};

const NOMBRES_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const HORA_UTC_MEDIANOCHE_ECUADOR = 5;

@Injectable()
export class AsistenteIaService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly presupuestosService: PresupuestosService,
    private readonly metasAhorroService: MetasAhorroService,
    private readonly conocimientoAsistenteService: ConocimientoAsistenteService,
    private readonly geminiService: GeminiService,
  ) {}

  // Crea una conversación perteneciente al usuario autenticado.
  async crearConversacion(
    usuarioId: number,
    crearConversacionDto: CrearConversacionDto,
  ) {
    const conversacion = await this.prismaService.conversacionAsistente.create({
      data: {
        titulo: crearConversacionDto.titulo,
        usuarioId,
      },
      select: {
        id: true,
        titulo: true,
        creadoEn: true,
        actualizadoEn: true,
      },
    });

    return {
      mensaje: 'Conversación creada correctamente',
      conversacion,
    };
  }

  // Lista únicamente las conversaciones activas del usuario autenticado.
  async listarConversaciones(usuarioId: number) {
    const conversaciones =
      await this.prismaService.conversacionAsistente.findMany({
        where: {
          usuarioId,
          eliminadoEn: null,
        },
        orderBy: {
          actualizadoEn: 'desc',
        },
        select: {
          id: true,
          titulo: true,
          creadoEn: true,
          actualizadoEn: true,
          _count: {
            select: {
              mensajes: true,
            },
          },
        },
      });

    return {
      total: conversaciones.length,
      conversaciones: conversaciones.map(({ _count, ...conversacion }) => ({
        ...conversacion,
        totalMensajes: _count.mensajes,
      })),
    };
  }

  // Obtiene una conversación propia junto con sus mensajes.
  async obtenerConversacion(usuarioId: number, conversacionId: number) {
    const conversacion =
      await this.prismaService.conversacionAsistente.findFirst({
        where: {
          id: conversacionId,
          usuarioId,
          eliminadoEn: null,
        },
        select: {
          id: true,
          titulo: true,
          creadoEn: true,
          actualizadoEn: true,
          mensajes: {
            orderBy: {
              creadoEn: 'asc',
            },
            select: {
              id: true,
              rol: true,
              contenido: true,
              origenRespuesta: true,
              creadoEn: true,
            },
          },
        },
      });

    if (!conversacion) {
      throw new NotFoundException(
        'La conversación no existe o no pertenece al usuario autenticado',
      );
    }

    return {
      conversacion,
    };
  }

  // Procesa una pregunta con Gemini y conserva el motor local como respaldo.
  async enviarMensaje(
    usuarioId: number,
    conversacionId: number,
    enviarMensajeDto: EnviarMensajeDto,
  ) {
    const conversacionExiste =
      await this.prismaService.conversacionAsistente.findFirst({
        where: {
          id: conversacionId,
          usuarioId,
          eliminadoEn: null,
        },
        select: {
          id: true,
        },
      });

    if (!conversacionExiste) {
      throw new NotFoundException(
        'La conversación no existe o no pertenece al usuario autenticado',
      );
    }

    const contenidoRespuestaInformativa =
      this.conocimientoAsistenteService.generarRespuesta(
        enviarMensajeDto.contenido,
      );

    let contextoFinanciero: ContextoFinanciero | null = null;
    let contenidoRespuestaLocal = contenidoRespuestaInformativa;

    /*
     * Las preguntas informativas no necesitan consultar ni enviar a Gemini
     * los movimientos, presupuestos o metas personales del usuario.
     */
    if (!contenidoRespuestaLocal) {
      const periodoConsulta = this.interpretarPeriodoConsulta(
        enviarMensajeDto.contenido,
      );

      contextoFinanciero = await this.obtenerContextoFinanciero(
        usuarioId,
        periodoConsulta,
      );

      contenidoRespuestaLocal = this.generarRespuestaLocal(
        enviarMensajeDto.contenido,
        contextoFinanciero,
      );
    }

    const usuarioActual = await this.prismaService.usuario.findUnique({
      where: { id: usuarioId },
      select: { geminiApiKey: true },
    });

    const contenidoRespuestaGemini = await this.geminiService.generarRespuesta(
      enviarMensajeDto.contenido,
      contextoFinanciero,
      contenidoRespuestaLocal,
      usuarioActual?.geminiApiKey,
    );

    const contenidoRespuesta =
      contenidoRespuestaGemini ?? contenidoRespuestaLocal;

    const origenRespuesta = contenidoRespuestaGemini
      ? 'GEMINI'
      : 'MOTOR_REGLAS';

    const [preguntaGuardada, respuestaGuardada] =
      await this.prismaService.$transaction([
        this.prismaService.mensajeAsistente.create({
          data: {
            rol: 'USUARIO',
            contenido: enviarMensajeDto.contenido,
            conversacionId,
          },
          select: {
            id: true,
            rol: true,
            contenido: true,
            origenRespuesta: true,
            creadoEn: true,
          },
        }),
        this.prismaService.mensajeAsistente.create({
          data: {
            rol: 'ASISTENTE',
            contenido: contenidoRespuesta,
            origenRespuesta,
            conversacionId,
          },
          select: {
            id: true,
            rol: true,
            contenido: true,
            origenRespuesta: true,
            creadoEn: true,
          },
        }),
        this.prismaService.conversacionAsistente.update({
          where: {
            id: conversacionId,
          },
          data: {
            actualizadoEn: new Date(),
          },
          select: {
            id: true,
          },
        }),
      ]);

    return {
      mensaje: 'Pregunta procesada correctamente',
      pregunta: preguntaGuardada,
      respuesta: respuestaGuardada,
    };
  }

  // Mantiene la ruta existente que solicita específicamente el mes actual.
  async obtenerContextoFinancieroMensual(
    usuarioId: number,
  ): Promise<ContextoFinanciero> {
    return this.obtenerContextoFinanciero(
      usuarioId,
      this.crearPeriodoMesActual(),
    );
  }

  // Resume los movimientos del período solicitado y agrega información relacionada.
  private async obtenerContextoFinanciero(
    usuarioId: number,
    periodo: PeriodoConsulta,
  ): Promise<ContextoFinanciero> {
    const presupuestosPromise =
      periodo.tipo === 'MES' && periodo.mes !== null
        ? this.presupuestosService.listarDelUsuario(usuarioId, {
            mes: periodo.mes,
            anio: periodo.anio,
          })
        : Promise.resolve(this.crearContextoPresupuestosVacio(periodo.anio));

    /*
     * Movimientos, presupuestos y metas se consultan en paralelo.
     * Los presupuestos solo se comparan en consultas mensuales porque
     * su límite está definido por mes y año.
     */
    const [movimientos, presupuestos, metasAhorro] = await Promise.all([
      this.prismaService.movimiento.findMany({
        where: {
          usuarioId,
          eliminadoEn: null,
          fecha: {
            gte: periodo.fechaDesdeUtc,
            lt: periodo.fechaHastaUtcExclusiva,
          },
        },
        select: {
          tipo: true,
          monto: true,
          categoria: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      }),
      presupuestosPromise,
      this.metasAhorroService.listarDelUsuario(usuarioId),
    ]);

    let totalIngresos = 0;
    let totalGastos = 0;

    const gastosPorCategoria = new Map<
      number,
      {
        id: number;
        nombre: string;
        total: number;
      }
    >();

    for (const movimiento of movimientos) {
      const monto = Number(movimiento.monto);

      if (movimiento.tipo === 'INGRESO') {
        totalIngresos += monto;
        continue;
      }

      totalGastos += monto;

      const gastoRegistrado = gastosPorCategoria.get(movimiento.categoria.id);

      if (gastoRegistrado) {
        gastoRegistrado.total += monto;
      } else {
        gastosPorCategoria.set(movimiento.categoria.id, {
          id: movimiento.categoria.id,
          nombre: movimiento.categoria.nombre,
          total: monto,
        });
      }
    }

    const categoriaMayorGasto =
      Array.from(gastosPorCategoria.values()).sort(
        (categoriaA, categoriaB) => categoriaB.total - categoriaA.total,
      )[0] ?? null;

    const saldo = totalIngresos - totalGastos;

    return {
      periodo: {
        tipo: periodo.tipo,
        descripcion: periodo.descripcion,
        fechaDesde: periodo.fechaDesde,
        fechaHasta: periodo.fechaHasta,
        mes: periodo.mes,
        anio: periodo.anio,
        incluyeFechaActual: periodo.incluyeFechaActual,
      },
      resumen: {
        totalIngresos: totalIngresos.toFixed(2),
        totalGastos: totalGastos.toFixed(2),
        saldo: saldo.toFixed(2),
        cantidadMovimientos: movimientos.length,
      },
      categoriaMayorGasto: categoriaMayorGasto
        ? {
            id: categoriaMayorGasto.id,
            nombre: categoriaMayorGasto.nombre,
            totalGastado: categoriaMayorGasto.total.toFixed(2),
          }
        : null,
      presupuestos,
      metasAhorro,
    };
  }

  // Interpreta expresiones de tiempo escritas por el usuario.
  private interpretarPeriodoConsulta(contenido: string): PeriodoConsulta {
    const pregunta = this.normalizarTexto(contenido);
    const fechaActual = this.obtenerFechaActualEcuador();

    const rangoNumerico = pregunta.match(
      /(?:desde|del)\s+(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\s+(?:hasta|al)\s+(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})/u,
    );

    if (rangoNumerico) {
      const fechaDesde = this.parsearFechaNumerica(rangoNumerico[1]);
      const fechaHasta = this.parsearFechaNumerica(rangoNumerico[2]);

      if (!fechaDesde || !fechaHasta) {
        throw new BadRequestException(
          'El rango de fechas no es válido. Usa el formato DD/MM/AAAA',
        );
      }

      const fechaDesdeUtc = this.crearFechaUtcEcuador(fechaDesde);
      const fechaHastaUtc = this.crearFechaUtcEcuador(fechaHasta);

      if (fechaDesdeUtc.getTime() > fechaHastaUtc.getTime()) {
        throw new BadRequestException(
          'La fecha inicial del rango no puede ser posterior a la fecha final',
        );
      }

      return this.construirPeriodo(
        'RANGO',
        fechaDesdeUtc,
        this.sumarDias(fechaHastaUtc, 1),
        `el período del ${this.formatearFechaLarga(fechaDesdeUtc)} al ${this.formatearFechaLarga(fechaHastaUtc)}`,
        null,
      );
    }

    const fechaEscrita = this.extraerFechaEscrita(pregunta);

    if (fechaEscrita) {
      return this.crearPeriodoDia(
        fechaEscrita,
        `el ${this.formatearFechaLarga(
          this.crearFechaUtcEcuador(fechaEscrita),
        )}`,
      );
    }

    if (pregunta.includes('anteayer')) {
      return this.crearPeriodoDia(
        this.desplazarFechaCalendario(fechaActual, -2),
        'anteayer',
      );
    }

    if (pregunta.includes('ayer')) {
      return this.crearPeriodoDia(
        this.desplazarFechaCalendario(fechaActual, -1),
        'ayer',
      );
    }

    if (this.contieneAlguna(pregunta, ['hoy', 'este dia', 'dia actual'])) {
      return this.crearPeriodoDia(fechaActual, 'hoy');
    }

    const ultimosDias = pregunta.match(
      /ultim(?:o|os|a|as)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|treinta)\s+dias?/u,
    );

    if (ultimosDias) {
      const cantidadDias = this.convertirCantidad(ultimosDias[1]);

      if (cantidadDias < 1 || cantidadDias > 3660) {
        throw new BadRequestException(
          'La cantidad de días debe estar entre 1 y 3660',
        );
      }

      const fechaDesde = this.desplazarFechaCalendario(
        fechaActual,
        -(cantidadDias - 1),
      );

      return this.construirPeriodo(
        'RANGO',
        this.crearFechaUtcEcuador(fechaDesde),
        this.sumarDias(this.crearFechaUtcEcuador(fechaActual), 1),
        `los últimos ${cantidadDias} días`,
        null,
      );
    }

    const semanasAnteriores = pregunta.match(
      /hace\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+semanas?/u,
    );

    if (semanasAnteriores) {
      return this.crearPeriodoSemana(
        fechaActual,
        -this.convertirCantidad(semanasAnteriores[1]),
      );
    }

    if (
      this.contieneAlguna(pregunta, [
        'semana pasada',
        'semana anterior',
        'ultima semana',
      ])
    ) {
      return this.crearPeriodoSemana(fechaActual, -1);
    }

    if (
      this.contieneAlguna(pregunta, [
        'esta semana',
        'semana actual',
        'en la semana',
      ])
    ) {
      return this.crearPeriodoSemana(fechaActual, 0);
    }

    const mesesAnteriores = pregunta.match(
      /hace\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+meses?/u,
    );

    if (mesesAnteriores) {
      const fechaMes = this.desplazarMes(
        fechaActual,
        -this.convertirCantidad(mesesAnteriores[1]),
      );

      return this.crearPeriodoMes(fechaMes.anio, fechaMes.indiceMes);
    }

    if (
      this.contieneAlguna(pregunta, [
        'mes pasado',
        'mes anterior',
        'ultimo mes',
      ])
    ) {
      const fechaMes = this.desplazarMes(fechaActual, -1);
      return this.crearPeriodoMes(fechaMes.anio, fechaMes.indiceMes);
    }

    if (
      this.contieneAlguna(pregunta, [
        'este mes',
        'mes actual',
        'durante el mes',
      ])
    ) {
      return this.crearPeriodoMes(fechaActual.anio, fechaActual.indiceMes);
    }

    const periodoMesNombrado = this.extraerMesNombrado(pregunta, fechaActual);

    if (periodoMesNombrado) {
      return this.crearPeriodoMes(
        periodoMesNombrado.anio,
        periodoMesNombrado.indiceMes,
      );
    }

    const aniosAnteriores = pregunta.match(
      /hace\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+anos?/u,
    );

    if (aniosAnteriores) {
      return this.crearPeriodoAnio(
        fechaActual.anio - this.convertirCantidad(aniosAnteriores[1]),
      );
    }

    if (
      this.contieneAlguna(pregunta, [
        'ano pasado',
        'ano anterior',
        'ultimo ano',
      ])
    ) {
      return this.crearPeriodoAnio(fechaActual.anio - 1);
    }

    if (
      this.contieneAlguna(pregunta, [
        'este ano',
        'ano actual',
        'durante el ano',
      ])
    ) {
      return this.crearPeriodoAnio(fechaActual.anio);
    }

    const anioMencionado = pregunta.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/u);

    if (anioMencionado) {
      return this.crearPeriodoAnio(Number(anioMencionado[1]));
    }

    return this.crearPeriodoMes(fechaActual.anio, fechaActual.indiceMes);
  }

  // Construye el mes actual para conservar el endpoint mensual existente.
  private crearPeriodoMesActual(): PeriodoConsulta {
    const fechaActual = this.obtenerFechaActualEcuador();
    return this.crearPeriodoMes(fechaActual.anio, fechaActual.indiceMes);
  }

  private crearPeriodoDia(
    fecha: FechaCalendario,
    descripcion: string,
  ): PeriodoConsulta {
    const fechaDesdeUtc = this.crearFechaUtcEcuador(fecha);

    return this.construirPeriodo(
      'DIA',
      fechaDesdeUtc,
      this.sumarDias(fechaDesdeUtc, 1),
      descripcion,
      null,
    );
  }

  private crearPeriodoSemana(
    fechaReferencia: FechaCalendario,
    desplazamientoSemanas: number,
  ): PeriodoConsulta {
    const fechaReferenciaUtc = this.crearFechaUtcEcuador(fechaReferencia);
    const diaSemana = fechaReferenciaUtc.getUTCDay();
    const diasDesdeLunes = (diaSemana + 6) % 7;

    const inicioSemanaActual = this.sumarDias(
      fechaReferenciaUtc,
      -diasDesdeLunes,
    );

    const fechaDesdeUtc = this.sumarDias(
      inicioSemanaActual,
      desplazamientoSemanas * 7,
    );

    const fechaHastaUtcExclusiva = this.sumarDias(fechaDesdeUtc, 7);
    const ultimoDiaSemana = this.sumarDias(fechaHastaUtcExclusiva, -1);

    return this.construirPeriodo(
      'SEMANA',
      fechaDesdeUtc,
      fechaHastaUtcExclusiva,
      `la semana del ${this.formatearFechaLarga(
        fechaDesdeUtc,
      )} al ${this.formatearFechaLarga(ultimoDiaSemana)}`,
      null,
    );
  }

  private crearPeriodoMes(anio: number, indiceMes: number): PeriodoConsulta {
    const fechaDesdeUtc = new Date(
      Date.UTC(anio, indiceMes, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    );

    const fechaHastaUtcExclusiva = new Date(
      Date.UTC(anio, indiceMes + 1, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    );

    const nombreMes = NOMBRES_MESES[indiceMes];

    return this.construirPeriodo(
      'MES',
      fechaDesdeUtc,
      fechaHastaUtcExclusiva,
      `${nombreMes} de ${anio}`,
      indiceMes + 1,
    );
  }

  private crearPeriodoAnio(anio: number): PeriodoConsulta {
    const fechaDesdeUtc = new Date(
      Date.UTC(anio, 0, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    );

    const fechaHastaUtcExclusiva = new Date(
      Date.UTC(anio + 1, 0, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    );

    return this.construirPeriodo(
      'ANIO',
      fechaDesdeUtc,
      fechaHastaUtcExclusiva,
      `el año ${anio}`,
      null,
    );
  }

  private construirPeriodo(
    tipo: TipoPeriodoConsulta,
    fechaDesdeUtc: Date,
    fechaHastaUtcExclusiva: Date,
    descripcion: string,
    mes: number | null,
  ): PeriodoConsulta {
    const fechaActualUtc = this.crearFechaUtcEcuador(
      this.obtenerFechaActualEcuador(),
    );

    const fechaHastaInclusiva = this.sumarDias(fechaHastaUtcExclusiva, -1);

    return {
      tipo,
      descripcion,
      fechaDesde: this.formatearFechaIso(fechaDesdeUtc),
      fechaHasta: this.formatearFechaIso(fechaHastaInclusiva),
      mes,
      anio: fechaDesdeUtc.getUTCFullYear(),
      incluyeFechaActual:
        fechaActualUtc.getTime() >= fechaDesdeUtc.getTime() &&
        fechaActualUtc.getTime() < fechaHastaUtcExclusiva.getTime(),
      fechaDesdeUtc,
      fechaHastaUtcExclusiva,
    };
  }

  private extraerFechaEscrita(pregunta: string): FechaCalendario | null {
    const fechaNumerica = pregunta.match(
      /\b(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\b/u,
    );

    if (fechaNumerica) {
      const fecha = this.parsearFechaNumerica(fechaNumerica[1]);

      if (!fecha) {
        throw new BadRequestException(
          'La fecha no es válida. Usa el formato DD/MM/AAAA',
        );
      }

      return fecha;
    }

    const nombresMeses = NOMBRES_MESES.join('|');

    const fechaLarga = pregunta.match(
      new RegExp(
        `\\b(\\d{1,2})\\s+de\\s+(${nombresMeses})\\s+(?:de\\s+)?(\\d{4})\\b`,
        'u',
      ),
    );

    if (!fechaLarga) {
      return null;
    }

    const fechaValidada = this.validarFechaCalendario(
      Number(fechaLarga[3]),
      NOMBRES_MESES.indexOf(fechaLarga[2] as (typeof NOMBRES_MESES)[number]),
      Number(fechaLarga[1]),
    );

    if (!fechaValidada) {
      throw new BadRequestException('La fecha indicada no es válida');
    }

    return fechaValidada;
  }

  private extraerMesNombrado(
    pregunta: string,
    fechaActual: FechaCalendario,
  ): { anio: number; indiceMes: number } | null {
    const indiceMes = NOMBRES_MESES.findIndex((nombreMes) =>
      new RegExp(`\\b${nombreMes}\\b`, 'u').test(pregunta),
    );

    if (indiceMes === -1) {
      return null;
    }

    const anioMencionado = pregunta.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/u);

    const anio = anioMencionado
      ? Number(anioMencionado[1])
      : indiceMes > fechaActual.indiceMes
        ? fechaActual.anio - 1
        : fechaActual.anio;

    return {
      anio,
      indiceMes,
    };
  }

  private parsearFechaNumerica(valor: string): FechaCalendario | null {
    const partes = valor.split(/[/-]/u).map(Number);

    if (partes.length !== 3) {
      return null;
    }

    if (partes[0] >= 1000) {
      return this.validarFechaCalendario(partes[0], partes[1] - 1, partes[2]);
    }

    return this.validarFechaCalendario(partes[2], partes[1] - 1, partes[0]);
  }

  private validarFechaCalendario(
    anio: number,
    indiceMes: number,
    dia: number,
  ): FechaCalendario | null {
    const fecha = new Date(Date.UTC(anio, indiceMes, dia));

    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== indiceMes ||
      fecha.getUTCDate() !== dia
    ) {
      return null;
    }

    return {
      anio,
      indiceMes,
      dia,
    };
  }

  private obtenerFechaActualEcuador(): FechaCalendario {
    const ahoraEcuador = new Date(Date.now() - 5 * 60 * 60 * 1000);

    return {
      anio: ahoraEcuador.getUTCFullYear(),
      indiceMes: ahoraEcuador.getUTCMonth(),
      dia: ahoraEcuador.getUTCDate(),
    };
  }

  private crearFechaUtcEcuador(fecha: FechaCalendario): Date {
    return new Date(
      Date.UTC(
        fecha.anio,
        fecha.indiceMes,
        fecha.dia,
        HORA_UTC_MEDIANOCHE_ECUADOR,
      ),
    );
  }

  private desplazarFechaCalendario(
    fecha: FechaCalendario,
    cantidadDias: number,
  ): FechaCalendario {
    const fechaDesplazada = this.sumarDias(
      this.crearFechaUtcEcuador(fecha),
      cantidadDias,
    );

    return {
      anio: fechaDesplazada.getUTCFullYear(),
      indiceMes: fechaDesplazada.getUTCMonth(),
      dia: fechaDesplazada.getUTCDate(),
    };
  }

  private desplazarMes(
    fecha: FechaCalendario,
    cantidadMeses: number,
  ): FechaCalendario {
    const fechaDesplazada = new Date(
      Date.UTC(
        fecha.anio,
        fecha.indiceMes + cantidadMeses,
        1,
        HORA_UTC_MEDIANOCHE_ECUADOR,
      ),
    );

    return {
      anio: fechaDesplazada.getUTCFullYear(),
      indiceMes: fechaDesplazada.getUTCMonth(),
      dia: 1,
    };
  }

  private sumarDias(fecha: Date, cantidadDias: number): Date {
    return new Date(fecha.getTime() + cantidadDias * MILISEGUNDOS_POR_DIA);
  }

  private formatearFechaIso(fecha: Date): string {
    const anio = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private formatearFechaLarga(fecha: Date): string {
    return (
      `${fecha.getUTCDate()} de ${NOMBRES_MESES[fecha.getUTCMonth()]} ` +
      `de ${fecha.getUTCFullYear()}`
    );
  }

  private convertirCantidad(valor: string): number {
    const cantidades: Record<string, number> = {
      un: 1,
      una: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      once: 11,
      doce: 12,
      quince: 15,
      treinta: 30,
    };

    return cantidades[valor] ?? Number(valor);
  }

  private crearContextoPresupuestosVacio(
    anio: number,
  ): ContextoPresupuestosMensuales {
    return {
      periodo: {
        mes: 0,
        anio,
      },
      total: 0,
      resumen: {
        montoPresupuestado: '0.00',
        montoGastado: '0.00',
        saldoDisponible: '0.00',
        porcentajeUtilizado: 0,
        presupuestosEnAlerta: 0,
        presupuestosExcedidos: 0,
      },
      presupuestos: [],
    };
  }

  // Identifica la intención de la pregunta y genera una respuesta.
  private generarRespuestaLocal(
    contenido: string,
    contexto: ContextoFinanciero,
  ): string {
    const pregunta = this.normalizarTexto(contenido);
    const periodo = contexto.periodo.descripcion;

    const { totalIngresos, totalGastos, saldo, cantidadMovimientos } =
      contexto.resumen;

    /*
     * La recomendación completa se evalúa antes que las consultas específicas.
     * Por ejemplo, "analiza mis presupuestos y metas" contiene la palabra
     * "presupuestos", pero debe combinar todos los datos financieros.
     */
    const solicitaRecomendacionCompleta =
      [
        'recomendacion completa',
        'recomendacion financiera completa',
        'recomendacion general',
        'analisis financiero completo',
        'analiza mis finanzas',
        'analizar mis finanzas',
        'mejorar mis finanzas',
        'como puedo mejorar mis finanzas',
        'consejo financiero completo',
      ].some((termino) => pregunta.includes(termino)) ||
      ((pregunta.includes('analiza') ||
        pregunta.includes('analizar') ||
        pregunta.includes('revisa') ||
        pregunta.includes('recomendacion') ||
        pregunta.includes('recomienda')) &&
        pregunta.includes('presupuesto') &&
        pregunta.includes('meta'));

    if (solicitaRecomendacionCompleta) {
      return this.generarRecomendacionFinancieraCompleta(contexto, periodo);
    }

    /*
     * Las alertas se comprueban antes de la consulta general.
     * Así, "presupuestos excedidos" devuelve únicamente los casos de riesgo.
     */
    const solicitaAlertasPresupuesto = [
      'presupuesto en alerta',
      'presupuestos en alerta',
      'presupuesto excedido',
      'presupuestos excedidos',
      'presupuesto superado',
      'presupuestos superados',
      'limite alcanzado',
      'limites alcanzados',
      'limite superado',
      'limites superados',
      'cerca del limite',
      'alcance mi presupuesto',
      'supere mi presupuesto',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaAlertasPresupuesto) {
      if (contexto.periodo.tipo !== 'MES') {
        return (
          'Las alertas de presupuesto se calculan por mes. ' +
          'Indícame el mes y el año que quieres revisar, por ejemplo: ' +
          '“¿Excedí algún presupuesto en julio de 2026?”'
        );
      }

      return this.generarRespuestaAlertasPresupuesto(contexto, periodo);
    }

    const solicitaPresupuestos = [
      'presupuesto',
      'presupuestos',
      'limite de gasto',
      'limites de gasto',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaPresupuestos) {
      if (contexto.periodo.tipo !== 'MES') {
        return (
          'Los presupuestos de Fintech se calculan por mes. ' +
          'Indícame un mes específico, por ejemplo: ' +
          '“¿Cómo estuvo mi presupuesto en julio de 2026?”'
        );
      }

      return this.generarRespuestaPresupuestos(contexto, periodo);
    }

    const solicitaResumen = [
      'resumen',
      'situacion financiera',
      'estado financiero',
      'como estan mis finanzas',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaResumen) {
      return (
        `Tu resumen financiero de ${periodo} es: ` +
        `ingresos de $${totalIngresos}, gastos de $${totalGastos} ` +
        `y un saldo de $${saldo}. ` +
        `Tienes ${cantidadMovimientos} movimientos registrados.`
      );
    }

    const solicitaCategoriaMayorGasto =
      (pregunta.includes('categoria') && pregunta.includes('gasto')) ||
      pregunta.includes('gaste mas') ||
      pregunta.includes('mayor gasto');

    if (solicitaCategoriaMayorGasto) {
      if (!contexto.categoriaMayorGasto) {
        return `No tienes gastos registrados durante ${periodo}.`;
      }

      return (
        `La categoría en la que más gastaste durante ${periodo} ` +
        `fue ${contexto.categoriaMayorGasto.nombre}, con un total ` +
        `de $${contexto.categoriaMayorGasto.totalGastado}.`
      );
    }

    const solicitaSaldo = [
      'saldo',
      'balance',
      'dinero disponible',
      'cuanto me queda',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaSaldo) {
      return (
        `Tu saldo calculado para ${periodo} es de $${saldo}. ` +
        'Este valor corresponde a tus ingresos menos tus gastos registrados.'
      );
    }

    /*
     * El progreso se comprueba antes de la consulta general de metas.
     * Así, "cuánto me falta para mi meta" incluye montos y porcentajes.
     */
    const mencionaMetaAhorro =
      pregunta.includes('meta') ||
      pregunta.includes('objetivo de ahorro') ||
      pregunta.includes('objetivos de ahorro');

    const mencionaProgresoMeta = [
      'progreso',
      'avance',
      'estado',
      'como va',
      'como van',
      'cuanto llevo',
      'cuanto he ahorrado',
      'cuanto tengo ahorrado',
      'cuanto me falta',
      'cuanto falta',
      'monto ahorrado',
      'monto restante',
      'faltante',
      'completada',
      'cumplida',
      'vencida',
    ].some((termino) => pregunta.includes(termino));

    const solicitaProgresoMetas =
      (mencionaMetaAhorro && mencionaProgresoMeta) ||
      [
        'cuanto llevo ahorrado para mis metas',
        'cuanto he ahorrado para mis metas',
        'cuanto tengo ahorrado en mis metas',
      ].some((termino) => pregunta.includes(termino));

    if (solicitaProgresoMetas) {
      if (!contexto.periodo.incluyeFechaActual) {
        return (
          'Puedo mostrar el progreso actual de tus metas, pero todavía no ' +
          'puedo reconstruir con exactitud cómo estaban en un período pasado. ' +
          'Las metas actuales se calculan con todos sus aportes activos.'
        );
      }

      return this.generarRespuestaProgresoMetas(contexto, pregunta);
    }

    const solicitaMetasAhorro =
      mencionaMetaAhorro ||
      ['mis objetivos', 'objetivos activos'].some((termino) =>
        pregunta.includes(termino),
      );

    if (solicitaMetasAhorro) {
      if (!contexto.periodo.incluyeFechaActual) {
        return (
          'Puedo mostrar tus metas activas actuales, pero todavía no existe ' +
          'un historial de estados de metas para el período solicitado.'
        );
      }

      return this.generarRespuestaMetasAhorro(contexto, pregunta);
    }

    /*
     * Esta intención se comprueba antes de la consulta general de gastos.
     * Así, "qué gastos debo reducir" no responde solamente el total gastado.
     */
    const solicitaReducirGastos = [
      'que gastos me recomiendas reducir',
      'que gasto me recomiendas reducir',
      'que gastos debo reducir',
      'que gasto debo reducir',
      'que gastos deberia reducir',
      'que gasto deberia reducir',
      'reducir mis gastos',
      'reducir gastos',
      'gastar menos',
      'disminuir mis gastos',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaReducirGastos) {
      return this.generarRecomendacionLocal(
        contexto,
        periodo,
        'REDUCIR_GASTOS',
      );
    }

    const solicitaAhorrar = [
      'que me recomiendas para ahorrar',
      'como puedo ahorrar',
      'recomendacion para ahorrar',
      'ahorrar',
      'ahorro',
      'guardar dinero',
      'separar dinero',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaAhorrar) {
      return this.generarRecomendacionLocal(contexto, periodo, 'AHORRAR');
    }

    const solicitaGastos = ['gasto', 'gastos', 'gaste', 'egresos'].some(
      (termino) => pregunta.includes(termino),
    );

    if (solicitaGastos) {
      return `Durante ${periodo} tienes $${totalGastos} registrados en gastos.`;
    }

    const solicitaIngresos = [
      'ingreso',
      'ingresos',
      'ingrese',
      'recibi',
      'ganancia',
    ].some((termino) => pregunta.includes(termino));

    if (solicitaIngresos) {
      return `Durante ${periodo} tienes $${totalIngresos} registrados en ingresos.`;
    }

    const solicitaCantidadMovimientos =
      pregunta.includes('movimientos') &&
      ['cuantos', 'cantidad', 'numero', 'registrados'].some((termino) =>
        pregunta.includes(termino),
      );

    if (solicitaCantidadMovimientos) {
      return (
        `Tienes ${cantidadMovimientos} movimientos activos ` +
        `registrados durante ${periodo}.`
      );
    }

    const esSaludo = [
      'hola',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
    ].some((saludo) => pregunta.includes(saludo));

    if (esSaludo) {
      return (
        'Hola. Puedo ayudarte a consultar tus ingresos, gastos, saldo, ' +
        'movimientos, presupuestos, alertas y metas de ahorro.'
      );
    }

    return (
      'Por ahora puedo responder preguntas sobre tus ingresos, gastos, ' +
      'saldo, movimientos, categoría con mayor gasto, recomendaciones, ' +
      'presupuestos, alertas presupuestarias y metas de ahorro.'
    );
  }

  // Lista las metas activas y presenta su objetivo, fecha y estado.
  private generarRespuestaMetasAhorro(
    contexto: ContextoFinanciero,
    pregunta: string,
  ): string {
    const { total, metas } = contexto.metasAhorro;

    if (total === 0) {
      return 'No tienes metas de ahorro activas registradas.';
    }

    const metasConsultadas = this.seleccionarMetasConsultadas(pregunta, metas);

    const detalleMetas = metasConsultadas
      .map(
        (meta) =>
          `${meta.nombre}: objetivo de $${meta.montoObjetivo}, ` +
          `fecha objetivo ${meta.fechaObjetivo}, estado ` +
          `${this.describirEstadoMeta(meta.estado)} y avance del ` +
          `${meta.porcentajeAvance} %`,
      )
      .join('; ');

    if (metasConsultadas.length !== total) {
      return `La meta que consultaste es: ${detalleMetas}.`;
    }

    return (
      `Tienes ${total} meta${total === 1 ? '' : 's'} de ahorro activa${
        total === 1 ? '' : 's'
      }. ` + `Detalle: ${detalleMetas}.`
    );
  }

  // Explica cuánto se ha ahorrado y cuánto falta para cada meta activa.
  private generarRespuestaProgresoMetas(
    contexto: ContextoFinanciero,
    pregunta: string,
  ): string {
    const { total, resumen, metas } = contexto.metasAhorro;

    if (total === 0) {
      return 'No tienes metas de ahorro activas para calcular su progreso.';
    }

    const metasConsultadas = this.seleccionarMetasConsultadas(pregunta, metas);

    const detalleProgreso = metasConsultadas
      .map((meta) => this.construirDetalleProgresoMeta(meta))
      .join('; ');

    if (total === 1) {
      return `Progreso de tu meta: ${detalleProgreso}.`;
    }

    if (metasConsultadas.length !== total) {
      return `Progreso de la meta consultada: ${detalleProgreso}.`;
    }

    return (
      `En todas tus metas has ahorrado $${resumen.montoAhorradoTotal} ` +
      `de un objetivo total de $${resumen.montoObjetivoTotal}, equivalente ` +
      `al ${resumen.porcentajeAhorroGeneral} %. Detalle: ${detalleProgreso}.`
    );
  }

  // Si la pregunta contiene el nombre de una meta, devuelve únicamente esa meta.
  private seleccionarMetasConsultadas(
    pregunta: string,
    metas: ContextoMetasAhorro['metas'],
  ): ContextoMetasAhorro['metas'] {
    const metasMencionadas = metas.filter((meta) =>
      pregunta.includes(this.normalizarTexto(meta.nombre)),
    );

    return metasMencionadas.length > 0 ? metasMencionadas : metas;
  }

  // Construye el detalle correcto según el estado real de la meta.
  private construirDetalleProgresoMeta(
    meta: ContextoMetasAhorro['metas'][number],
  ): string {
    const progresoBase =
      `${meta.nombre}: has ahorrado $${meta.montoAhorrado} de ` +
      `$${meta.montoObjetivo} (${meta.porcentajeAvance} %)`;

    if (meta.estado === 'COMPLETADA') {
      return `${progresoBase}; la meta está completada`;
    }

    if (meta.estado === 'VENCIDA') {
      return (
        `${progresoBase}; todavía faltan $${meta.montoRestante} y la fecha ` +
        `objetivo venció el ${meta.fechaObjetivo}`
      );
    }

    if (meta.estado === 'SIN_APORTES') {
      return (
        `${meta.nombre}: todavía no registras aportes, faltan ` +
        `$${meta.montoRestante} para alcanzar el objetivo y ` +
        `${this.describirTiempoMeta(meta)}`
      );
    }

    return (
      `${progresoBase}; faltan $${meta.montoRestante} y ` +
      `${this.describirTiempoMeta(meta)}`
    );
  }

  // Convierte el estado técnico de una meta en una frase comprensible.
  private describirEstadoMeta(estado: EstadoMetaAhorro): string {
    const descripciones: Record<EstadoMetaAhorro, string> = {
      SIN_APORTES: 'sin aportes',
      EN_PROGRESO: 'en progreso',
      COMPLETADA: 'completada',
      VENCIDA: 'vencida',
    };

    return descripciones[estado];
  }

  // Describe el tiempo disponible o informa que la meta ya venció.
  private describirTiempoMeta(
    meta: ContextoMetasAhorro['metas'][number],
  ): string {
    if (meta.estado === 'VENCIDA') {
      return 'la fecha objetivo ya venció';
    }

    if (meta.diasRestantes === 0) {
      return 'la fecha objetivo es hoy';
    }

    if (meta.diasRestantes === 1) {
      return 'queda 1 día para la fecha objetivo';
    }

    return `quedan ${meta.diasRestantes} días para la fecha objetivo`;
  }

  // Explica el consumo de los presupuestos activos del mes consultado.
  private generarRespuestaPresupuestos(
    contexto: ContextoFinanciero,
    periodo: string,
  ): string {
    const { total, resumen, presupuestos } = contexto.presupuestos;

    if (total === 0) {
      return `No tienes presupuestos activos registrados para ${periodo}.`;
    }

    const detallePresupuestos = presupuestos
      .map(
        (presupuesto) =>
          `${presupuesto.categoria.nombre}: gastaste ` +
          `$${presupuesto.montoGastado} de $${presupuesto.montoLimite} ` +
          `(${presupuesto.porcentajeUtilizado} %, ` +
          `${this.describirEstadoPresupuesto(presupuesto.estado)})`,
      )
      .join('; ');

    return (
      `Tienes ${total} presupuesto${total === 1 ? '' : 's'} activo${
        total === 1 ? '' : 's'
      } durante ${periodo}. En total has gastado ` +
      `$${resumen.montoGastado} de $${resumen.montoPresupuestado}, ` +
      `equivalente al ${resumen.porcentajeUtilizado} %. Detalle: ` +
      `${detallePresupuestos}.`
    );
  }

  // Informa únicamente presupuestos en alerta, alcanzados o excedidos.
  private generarRespuestaAlertasPresupuesto(
    contexto: ContextoFinanciero,
    periodo: string,
  ): string {
    const presupuestosConRiesgo = contexto.presupuestos.presupuestos.filter(
      (presupuesto) =>
        presupuesto.estado === 'EN_ALERTA' ||
        presupuesto.estado === 'LIMITE_ALCANZADO' ||
        presupuesto.estado === 'EXCEDIDO',
    );

    if (contexto.presupuestos.total === 0) {
      return `No tienes presupuestos activos registrados para ${periodo}.`;
    }

    if (presupuestosConRiesgo.length === 0) {
      return (
        `Ninguno de tus presupuestos está en alerta o excedido durante ` +
        `${periodo}. Todos permanecen dentro de sus límites configurados.`
      );
    }

    const detalles = presupuestosConRiesgo
      .map((presupuesto) => {
        if (presupuesto.estado === 'EXCEDIDO') {
          const montoExcedido = Math.abs(
            Number(presupuesto.saldoDisponible),
          ).toFixed(2);

          return (
            `${presupuesto.categoria.nombre} está excedido por ` +
            `$${montoExcedido}: gastaste $${presupuesto.montoGastado} ` +
            `de un límite de $${presupuesto.montoLimite}`
          );
        }

        if (presupuesto.estado === 'LIMITE_ALCANZADO') {
          return (
            `${presupuesto.categoria.nombre} alcanzó exactamente su límite ` +
            `de $${presupuesto.montoLimite}`
          );
        }

        return (
          `${presupuesto.categoria.nombre} está en alerta con el ` +
          `${presupuesto.porcentajeUtilizado} % utilizado; su alerta comienza ` +
          `en el ${presupuesto.porcentajeAlerta} %`
        );
      })
      .join('; ');

    return `Alertas presupuestarias de ${periodo}: ${detalles}.`;
  }

  // Convierte el estado técnico del presupuesto en una frase comprensible.
  private describirEstadoPresupuesto(estado: EstadoPresupuestoMensual): string {
    const descripciones: Record<EstadoPresupuestoMensual, string> = {
      SIN_CONSUMO: 'sin consumo',
      DENTRO_DEL_LIMITE: 'dentro del límite',
      EN_ALERTA: 'en alerta',
      LIMITE_ALCANZADO: 'límite alcanzado',
      EXCEDIDO: 'excedido',
    };

    return descripciones[estado];
  }

  // Combina movimientos, presupuestos y metas en una recomendación priorizada.
  private generarRecomendacionFinancieraCompleta(
    contexto: ContextoFinanciero,
    periodo: string,
  ): string {
    const totalIngresos = Number(contexto.resumen.totalIngresos);
    const totalGastos = Number(contexto.resumen.totalGastos);
    const saldo = Number(contexto.resumen.saldo);
    const prioridades: string[] = [];

    let diagnostico =
      `Análisis financiero de ${periodo}: registras ingresos de ` +
      `$${contexto.resumen.totalIngresos}, gastos de ` +
      `$${contexto.resumen.totalGastos} y un saldo de ` +
      `$${contexto.resumen.saldo}.`;

    if (contexto.resumen.cantidadMovimientos === 0) {
      diagnostico =
        `Análisis financiero de ${periodo}: todavía no tienes movimientos ` +
        'registrados, por lo que no es posible evaluar completamente tus finanzas.';

      prioridades.push(
        'Registra tus ingresos y gastos para obtener recomendaciones basadas en datos reales',
      );
    } else if (saldo < 0) {
      prioridades.push(
        `Tus gastos superan tus ingresos por $${Math.abs(saldo).toFixed(2)}; ` +
          'detén gastos no esenciales y corrige primero este déficit',
      );
    } else if (saldo === 0) {
      prioridades.push(
        'Has utilizado todos tus ingresos del período; evita nuevos gastos hasta recuperar un margen disponible',
      );
    } else if (totalIngresos > 0) {
      const porcentajeGastado = Math.round((totalGastos / totalIngresos) * 100);

      if (porcentajeGastado >= 80) {
        prioridades.push(
          `Ya utilizaste aproximadamente el ${porcentajeGastado} % de tus ` +
            'ingresos; limita nuevos gastos para proteger el saldo restante',
        );
      }
    }

    if (contexto.periodo.tipo === 'MES') {
      const prioridadEstadoPresupuesto: Record<
        EstadoPresupuestoMensual,
        number
      > = {
        SIN_CONSUMO: 0,
        DENTRO_DEL_LIMITE: 0,
        EN_ALERTA: 1,
        LIMITE_ALCANZADO: 2,
        EXCEDIDO: 3,
      };

      const presupuestosConRiesgo = contexto.presupuestos.presupuestos
        .filter(
          (presupuesto) =>
            presupuesto.estado === 'EN_ALERTA' ||
            presupuesto.estado === 'LIMITE_ALCANZADO' ||
            presupuesto.estado === 'EXCEDIDO',
        )
        .sort((presupuestoA, presupuestoB) => {
          const diferenciaPrioridad =
            prioridadEstadoPresupuesto[presupuestoB.estado] -
            prioridadEstadoPresupuesto[presupuestoA.estado];

          if (diferenciaPrioridad !== 0) {
            return diferenciaPrioridad;
          }

          return (
            presupuestoB.porcentajeUtilizado - presupuestoA.porcentajeUtilizado
          );
        });

      const presupuestoPrioritario = presupuestosConRiesgo[0];

      if (presupuestoPrioritario?.estado === 'EXCEDIDO') {
        const montoExcedido = Math.abs(
          Number(presupuestoPrioritario.saldoDisponible),
        ).toFixed(2);

        prioridades.push(
          `El presupuesto de ${presupuestoPrioritario.categoria.nombre} está ` +
            `excedido por $${montoExcedido}; no registres nuevos gastos en esa ` +
            'categoría y revisa qué consumos puedes reducir',
        );
      } else if (presupuestoPrioritario?.estado === 'LIMITE_ALCANZADO') {
        prioridades.push(
          `El presupuesto de ${presupuestoPrioritario.categoria.nombre} ya ` +
            `alcanzó su límite de $${presupuestoPrioritario.montoLimite}; evita ` +
            'nuevos gastos en esa categoría durante el resto del mes',
        );
      } else if (presupuestoPrioritario?.estado === 'EN_ALERTA') {
        prioridades.push(
          `El presupuesto de ${presupuestoPrioritario.categoria.nombre} está en ` +
            `alerta con el ${presupuestoPrioritario.porcentajeUtilizado} % ` +
            `utilizado y conserva $${presupuestoPrioritario.saldoDisponible}; ` +
            'controla esa categoría antes de alcanzar el límite',
        );
      } else if (contexto.presupuestos.total === 0) {
        prioridades.push(
          'Crea al menos un presupuesto para controlar las categorías en las que gastas con mayor frecuencia',
        );
      } else {
        diagnostico += ` Tus ${contexto.presupuestos.total} presupuesto${
          contexto.presupuestos.total === 1 ? '' : 's'
        } permanecen dentro de sus límites.`;
      }
    }

    if (contexto.categoriaMayorGasto && totalGastos > 0) {
      const porcentajeCategoria = Math.round(
        (Number(contexto.categoriaMayorGasto.totalGastado) / totalGastos) * 100,
      );

      prioridades.push(
        `Revisa ${contexto.categoriaMayorGasto.nombre}, porque es tu categoría ` +
          `de mayor gasto con $${contexto.categoriaMayorGasto.totalGastado}, ` +
          `aproximadamente el ${porcentajeCategoria} % de todos tus gastos`,
      );
    }

    if (contexto.periodo.incluyeFechaActual) {
      const metasPendientes = contexto.metasAhorro.metas
        .filter(
          (meta) =>
            meta.estado === 'SIN_APORTES' || meta.estado === 'EN_PROGRESO',
        )
        .sort((metaA, metaB) => {
          if (metaA.diasRestantes !== metaB.diasRestantes) {
            return metaA.diasRestantes - metaB.diasRestantes;
          }

          return Number(metaA.montoRestante) - Number(metaB.montoRestante);
        });

      const metaPrioritaria = metasPendientes[0];

      if (metaPrioritaria) {
        const montoRestante = Number(metaPrioritaria.montoRestante);

        if (saldo > 0 && totalIngresos > 0 && montoRestante > 0) {
          const aporteMaximo = Math.min(
            totalIngresos * 0.1,
            saldo,
            montoRestante,
          );

          const aporteSugerido = Math.floor(aporteMaximo * 100) / 100;

          if (aporteSugerido >= 0.01) {
            prioridades.push(
              `Destina hasta $${aporteSugerido.toFixed(2)} a la meta ` +
                `${metaPrioritaria.nombre}; le faltan ` +
                `$${metaPrioritaria.montoRestante} y tiene ` +
                `${this.describirTiempoMeta(metaPrioritaria)}. El aporte sugerido ` +
                'no supera el 10 % de tus ingresos, tu saldo disponible ni el monto faltante',
            );
          } else {
            prioridades.push(
              `La meta ${metaPrioritaria.nombre} todavía necesita ` +
                `$${metaPrioritaria.montoRestante}, pero tu saldo disponible no ` +
                'permite sugerir un aporte mínimo de $0.01 por ahora',
            );
          }
        } else {
          prioridades.push(
            `La meta ${metaPrioritaria.nombre} todavía necesita ` +
              `$${metaPrioritaria.montoRestante}, pero no te recomiendo aportar ` +
              'por ahora porque primero debes recuperar un saldo positivo',
          );
        }
      } else {
        const metaVencida = contexto.metasAhorro.metas.find(
          (meta) => meta.estado === 'VENCIDA',
        );

        if (metaVencida) {
          prioridades.push(
            `La meta ${metaVencida.nombre} está vencida y todavía le faltan ` +
              `$${metaVencida.montoRestante}; revisa su fecha objetivo antes de ` +
              'planificar nuevos aportes',
          );
        } else if (contexto.metasAhorro.total === 0) {
          prioridades.push(
            'Crea una meta de ahorro con monto y fecha objetivo para organizar el dinero que puedas separar',
          );
        } else {
          prioridades.push(
            'Todas tus metas activas están completadas; puedes crear una nueva meta para continuar ahorrando',
          );
        }
      }
    }

    if (prioridades.length === 0) {
      prioridades.push(
        'Compara este resultado con otros períodos para identificar cambios en tus ingresos y gastos',
      );
    }

    const detallePrioridades = prioridades
      .map((prioridad, indice) => `Prioridad ${indice + 1}: ${prioridad}.`)
      .join(' ');

    return `${diagnostico} ${detallePrioridades}`;
  }

  // Genera una recomendación diferente según la intención detectada.
  private generarRecomendacionLocal(
    contexto: ContextoFinanciero,
    periodo: string,
    tipoRecomendacion: TipoRecomendacionLocal,
  ): string {
    const totalIngresos = Number(contexto.resumen.totalIngresos);
    const totalGastos = Number(contexto.resumen.totalGastos);
    const saldo = Number(contexto.resumen.saldo);
    const categoriaMayorGasto = contexto.categoriaMayorGasto;

    if (totalIngresos === 0 && totalGastos === 0) {
      return (
        `Todavía no tienes ingresos ni gastos registrados durante ${periodo}. ` +
        'Registra tus movimientos para recibir recomendaciones basadas en tus datos.'
      );
    }

    /*
     * Si el usuario quiere reducir gastos, se analiza la categoría
     * que representa el consumo más alto del período.
     */
    if (tipoRecomendacion === 'REDUCIR_GASTOS') {
      if (totalGastos === 0) {
        return (
          `No tienes gastos registrados durante ${periodo}, ` +
          'por lo que todavía no puedo identificar qué gasto conviene reducir.'
        );
      }

      if (!categoriaMayorGasto) {
        return (
          `Tienes $${contexto.resumen.totalGastos} registrados en gastos ` +
          `durante ${periodo}, pero no pude identificar una categoría principal.`
        );
      }

      const porcentajeCategoria = Math.round(
        (Number(categoriaMayorGasto.totalGastado) / totalGastos) * 100,
      );

      return (
        `La primera categoría que podrías revisar es ` +
        `${categoriaMayorGasto.nombre}, porque es donde más gastaste durante ` +
        `${periodo}: $${categoriaMayorGasto.totalGastado}, aproximadamente el ` +
        `${porcentajeCategoria} % de todos tus gastos. Revisa si dentro de esa ` +
        'categoría existen consumos no esenciales que puedas disminuir.'
      );
    }

    if (totalGastos === 0) {
      const ahorroSugerido = (totalIngresos * 0.1).toFixed(2);

      return (
        `No tienes gastos registrados durante ${periodo}. ` +
        `Como primer objetivo, podrías separar al menos $${ahorroSugerido}, ` +
        'equivalente al 10 % de tus ingresos, para iniciar o aumentar tu ahorro.'
      );
    }

    if (totalIngresos === 0) {
      if (categoriaMayorGasto) {
        return (
          `No tienes ingresos registrados durante ${periodo}, pero sí ` +
          `presentas $${contexto.resumen.totalGastos} en gastos. ` +
          `Revisa primero la categoría ${categoriaMayorGasto.nombre}, ` +
          `donde gastaste $${categoriaMayorGasto.totalGastado}, y evita ` +
          'asumir nuevos gastos hasta registrar o recibir ingresos.'
        );
      }

      return (
        `No tienes ingresos registrados durante ${periodo}. ` +
        'Te recomiendo revisar tus gastos antes de asumir nuevos compromisos financieros.'
      );
    }

    const porcentajeGastado = Math.round((totalGastos / totalIngresos) * 100);

    if (porcentajeGastado > 100) {
      const deficit = Math.abs(saldo).toFixed(2);

      return (
        `Durante ${periodo} tus gastos representan aproximadamente el ` +
        `${porcentajeGastado} % de tus ingresos y tienes un déficit de ` +
        `$${deficit}. Te recomiendo detener gastos no esenciales y revisar ` +
        `primero la categoría ${
          categoriaMayorGasto?.nombre ?? 'con mayor gasto'
        }.`
      );
    }

    if (porcentajeGastado >= 80) {
      return (
        `Durante ${periodo} ya utilizaste aproximadamente el ` +
        `${porcentajeGastado} % de tus ingresos. Tu margen disponible es ` +
        `de $${saldo.toFixed(2)}. Te recomiendo limitar nuevos gastos y ` +
        `revisar especialmente ${
          categoriaMayorGasto?.nombre ?? 'tu categoría con mayor consumo'
        }.`
      );
    }

    const ahorroSugerido = Math.min(totalIngresos * 0.1, saldo).toFixed(2);

    if (porcentajeGastado >= 50) {
      return (
        `Durante ${periodo} tus gastos representan aproximadamente el ` +
        `${porcentajeGastado} % de tus ingresos. Podrías separar ` +
        `$${ahorroSugerido} como ahorro inicial y vigilar ` +
        `${categoriaMayorGasto?.nombre ?? 'tu categoría con mayor gasto'}, ` +
        'para evitar que aumente en los próximos días.'
      );
    }

    const detalleCategoria = categoriaMayorGasto
      ? `${categoriaMayorGasto.nombre}, con $${categoriaMayorGasto.totalGastado}.`
      : 'aún no identificada.';

    return (
      `Vas por buen camino: durante ${periodo} tus gastos representan ` +
      `aproximadamente el ${porcentajeGastado} % de tus ingresos y conservas ` +
      `un saldo de $${saldo.toFixed(2)}. Como primer objetivo, podrías separar ` +
      `$${ahorroSugerido}, equivalente al 10 % de tus ingresos, para tu ahorro. ` +
      `Tu categoría con mayor gasto es ${detalleCategoria}`
    );
  }

  // Convierte el texto a minúsculas y elimina tildes para compararlo.
  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private contieneAlguna(texto: string, expresiones: string[]): boolean {
    return expresiones.some((expresion) => texto.includes(expresion));
  }
}
