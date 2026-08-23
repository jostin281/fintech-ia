import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarMetaAhorroDto } from './dto/actualizar-meta-ahorro.dto';
import { CrearAporteMetaDto } from './dto/crear-aporte-meta.dto';
import { CrearMetaAhorroDto } from './dto/crear-meta-ahorro.dto';

const DESFASE_HORARIO_ECUADOR_EN_HORAS = -5;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

type EstadoMetaAhorro =
  'SIN_APORTES' | 'EN_PROGRESO' | 'COMPLETADA' | 'VENCIDA';

@Injectable()
export class MetasAhorroService {
  constructor(private readonly prismaService: PrismaService) {}

  async crear(usuarioId: number, crearMetaAhorroDto: CrearMetaAhorroDto) {
    this.validarFechaObjetivoNoPasada(crearMetaAhorroDto.fechaObjetivo);

    const metaCreada = await this.prismaService.metaAhorro.create({
      data: {
        nombre: crearMetaAhorroDto.nombre,
        montoObjetivo: crearMetaAhorroDto.montoObjetivo,
        fechaObjetivo: this.convertirFechaTexto(
          crearMetaAhorroDto.fechaObjetivo,
        ),
        activo: true,
        usuarioId,
      },
      select: {
        id: true,
      },
    });

    const resultado = await this.obtenerUnaDelUsuario(usuarioId, metaCreada.id);

    return {
      mensaje: 'Meta de ahorro creada correctamente',
      meta: resultado.meta,
    };
  }

  async listarDelUsuario(usuarioId: number) {
    const metas = await this.prismaService.metaAhorro.findMany({
      where: {
        usuarioId,
        activo: true,
      },
      orderBy: [
        {
          fechaObjetivo: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: {
        id: true,
        nombre: true,
        montoObjetivo: true,
        fechaObjetivo: true,
        activo: true,
        creadoEn: true,
        actualizadoEn: true,
      },
    });

    const metaReferencia = metas[0];

    if (metaReferencia === undefined) {
      return {
        total: 0,
        resumen: {
          montoObjetivoTotal: '0.00',
          montoAhorradoTotal: '0.00',
          porcentajeAhorroGeneral: 0,
          metasSinAportes: 0,
          metasEnProgreso: 0,
          metasCompletadas: 0,
          metasVencidas: 0,
        },
        metas: [],
      };
    }

    const metaIds = metas.map((meta) => meta.id);

    const aportesAgrupados = await this.prismaService.aporteMeta.groupBy({
      by: ['metaAhorroId'],
      where: {
        metaAhorroId: {
          in: metaIds,
        },
        eliminadoEn: null,
      },
      _sum: {
        monto: true,
      },
    });

    const aportesPorMeta = new Map(
      aportesAgrupados.map(
        (aporte) => [aporte.metaAhorroId, aporte._sum.monto] as const,
      ),
    );

    const montoCero = metaReferencia.montoObjetivo.minus(
      metaReferencia.montoObjetivo,
    );

    let montoObjetivoTotal = montoCero;
    let montoAhorradoTotal = montoCero;
    let metasSinAportes = 0;
    let metasEnProgreso = 0;
    let metasCompletadas = 0;
    let metasVencidas = 0;

    const fechaActual = this.obtenerFechaActualEcuador();

    const metasCalculadas = metas.map((meta) => {
      const montoAhorrado = aportesPorMeta.get(meta.id) ?? montoCero;

      const montoRestanteCalculado = meta.montoObjetivo.minus(montoAhorrado);

      const montoRestante = montoRestanteCalculado.lessThan(0)
        ? montoCero
        : montoRestanteCalculado;

      const porcentajeAvance = Number(
        montoAhorrado.dividedBy(meta.montoObjetivo).times(100).toFixed(2),
      );

      const estado = this.obtenerEstadoMeta(
        montoAhorrado.isZero(),
        montoAhorrado.greaterThanOrEqualTo(meta.montoObjetivo),
        meta.fechaObjetivo,
        fechaActual,
      );

      if (estado === 'SIN_APORTES') {
        metasSinAportes += 1;
      } else if (estado === 'EN_PROGRESO') {
        metasEnProgreso += 1;
      } else if (estado === 'COMPLETADA') {
        metasCompletadas += 1;
      } else {
        metasVencidas += 1;
      }

      montoObjetivoTotal = montoObjetivoTotal.plus(meta.montoObjetivo);

      montoAhorradoTotal = montoAhorradoTotal.plus(montoAhorrado);

      return {
        id: meta.id,
        nombre: meta.nombre,
        montoObjetivo: meta.montoObjetivo.toFixed(2),
        montoAhorrado: montoAhorrado.toFixed(2),
        montoRestante: montoRestante.toFixed(2),
        porcentajeAvance,
        estado,
        fechaObjetivo: this.formatearFecha(meta.fechaObjetivo),
        diasRestantes: this.calcularDiasRestantes(
          meta.fechaObjetivo,
          fechaActual,
        ),
        activo: meta.activo,
        creadoEn: meta.creadoEn,
        actualizadoEn: meta.actualizadoEn,
      };
    });

    const porcentajeAhorroGeneral = montoObjetivoTotal.isZero()
      ? 0
      : Number(
          montoAhorradoTotal
            .dividedBy(montoObjetivoTotal)
            .times(100)
            .toFixed(2),
        );

    return {
      total: metasCalculadas.length,
      resumen: {
        montoObjetivoTotal: montoObjetivoTotal.toFixed(2),
        montoAhorradoTotal: montoAhorradoTotal.toFixed(2),
        porcentajeAhorroGeneral,
        metasSinAportes,
        metasEnProgreso,
        metasCompletadas,
        metasVencidas,
      },
      metas: metasCalculadas,
    };
  }

  async obtenerUnaDelUsuario(usuarioId: number, metaAhorroId: number) {
    const meta = await this.buscarMetaPropiaActiva(usuarioId, metaAhorroId);

    if (!meta) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    const resumenAportes = await this.prismaService.aporteMeta.aggregate({
      where: {
        metaAhorroId,
        eliminadoEn: null,
      },
      _sum: {
        monto: true,
      },
      _count: {
        id: true,
      },
    });

    const montoCero = meta.montoObjetivo.minus(meta.montoObjetivo);

    const montoAhorrado = resumenAportes._sum.monto ?? montoCero;

    const montoRestanteCalculado = meta.montoObjetivo.minus(montoAhorrado);

    const montoRestante = montoRestanteCalculado.lessThan(0)
      ? montoCero
      : montoRestanteCalculado;

    const porcentajeAvance = Number(
      montoAhorrado.dividedBy(meta.montoObjetivo).times(100).toFixed(2),
    );

    const fechaActual = this.obtenerFechaActualEcuador();

    const estado = this.obtenerEstadoMeta(
      montoAhorrado.isZero(),
      montoAhorrado.greaterThanOrEqualTo(meta.montoObjetivo),
      meta.fechaObjetivo,
      fechaActual,
    );

    return {
      meta: {
        id: meta.id,
        nombre: meta.nombre,
        montoObjetivo: meta.montoObjetivo.toFixed(2),
        montoAhorrado: montoAhorrado.toFixed(2),
        montoRestante: montoRestante.toFixed(2),
        porcentajeAvance,
        estado,
        fechaObjetivo: this.formatearFecha(meta.fechaObjetivo),
        diasRestantes: this.calcularDiasRestantes(
          meta.fechaObjetivo,
          fechaActual,
        ),
        totalAportes: resumenAportes._count.id,
        activo: meta.activo,
        creadoEn: meta.creadoEn,
        actualizadoEn: meta.actualizadoEn,
      },
    };
  }

  async actualizar(
    usuarioId: number,
    metaAhorroId: number,
    actualizarMetaAhorroDto: ActualizarMetaAhorroDto,
  ) {
    const noEnvioNombre = actualizarMetaAhorroDto.nombre === undefined;

    const noEnvioMonto = actualizarMetaAhorroDto.montoObjetivo === undefined;

    const noEnvioFecha = actualizarMetaAhorroDto.fechaObjetivo === undefined;

    if (noEnvioNombre && noEnvioMonto && noEnvioFecha) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    if (actualizarMetaAhorroDto.fechaObjetivo !== undefined) {
      this.validarFechaObjetivoNoPasada(actualizarMetaAhorroDto.fechaObjetivo);
    }

    const resultado = await this.prismaService.metaAhorro.updateMany({
      where: {
        id: metaAhorroId,
        usuarioId,
        activo: true,
      },
      data: {
        ...(actualizarMetaAhorroDto.nombre !== undefined
          ? {
              nombre: actualizarMetaAhorroDto.nombre,
            }
          : {}),

        ...(actualizarMetaAhorroDto.montoObjetivo !== undefined
          ? {
              montoObjetivo: actualizarMetaAhorroDto.montoObjetivo,
            }
          : {}),

        ...(actualizarMetaAhorroDto.fechaObjetivo !== undefined
          ? {
              fechaObjetivo: this.convertirFechaTexto(
                actualizarMetaAhorroDto.fechaObjetivo,
              ),
            }
          : {}),
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    const metaActualizada = await this.obtenerUnaDelUsuario(
      usuarioId,
      metaAhorroId,
    );

    return {
      mensaje: 'Meta de ahorro actualizada correctamente',
      meta: metaActualizada.meta,
    };
  }

  async eliminar(usuarioId: number, metaAhorroId: number) {
    const resultado = await this.prismaService.metaAhorro.updateMany({
      where: {
        id: metaAhorroId,
        usuarioId,
        activo: true,
      },
      data: {
        activo: false,
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    return {
      mensaje: 'Meta de ahorro eliminada correctamente',
      meta: {
        id: metaAhorroId,
        activo: false,
      },
    };
  }

  async registrarAporte(
    usuarioId: number,
    metaAhorroId: number,
    crearAporteMetaDto: CrearAporteMetaDto,
  ) {
    const meta = await this.buscarMetaPropiaActiva(usuarioId, metaAhorroId);

    if (!meta) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    const aporte = await this.prismaService.aporteMeta.create({
      data: {
        monto: crearAporteMetaDto.monto,
        metaAhorroId,
      },
      select: {
        id: true,
        monto: true,
        creadoEn: true,
      },
    });

    const metaActualizada = await this.obtenerUnaDelUsuario(
      usuarioId,
      metaAhorroId,
    );

    return {
      mensaje: 'Aporte registrado correctamente',
      aporte: {
        id: aporte.id,
        monto: aporte.monto.toFixed(2),
        creadoEn: aporte.creadoEn,
      },
      meta: metaActualizada.meta,
    };
  }

  async listarAportes(usuarioId: number, metaAhorroId: number) {
    const meta = await this.buscarMetaPropiaActiva(usuarioId, metaAhorroId);

    if (!meta) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    const aportes = await this.prismaService.aporteMeta.findMany({
      where: {
        metaAhorroId,
        eliminadoEn: null,
      },
      orderBy: [
        {
          creadoEn: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      select: {
        id: true,
        monto: true,
        creadoEn: true,
      },
    });

    let montoAhorrado = meta.montoObjetivo.minus(meta.montoObjetivo);

    for (const aporte of aportes) {
      montoAhorrado = montoAhorrado.plus(aporte.monto);
    }

    return {
      meta: {
        id: meta.id,
        nombre: meta.nombre,
      },
      total: aportes.length,
      montoAhorrado: montoAhorrado.toFixed(2),
      aportes: aportes.map((aporte) => ({
        id: aporte.id,
        monto: aporte.monto.toFixed(2),
        creadoEn: aporte.creadoEn,
      })),
    };
  }

  async eliminarAporte(
    usuarioId: number,
    metaAhorroId: number,
    aporteId: number,
  ) {
    const meta = await this.buscarMetaPropiaActiva(usuarioId, metaAhorroId);

    if (!meta) {
      throw new NotFoundException('La meta de ahorro solicitada no existe');
    }

    const fechaEliminacion = new Date();

    const resultado = await this.prismaService.aporteMeta.updateMany({
      where: {
        id: aporteId,
        metaAhorroId,
        eliminadoEn: null,
      },
      data: {
        eliminadoEn: fechaEliminacion,
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('El aporte solicitado no existe');
    }

    const metaActualizada = await this.obtenerUnaDelUsuario(
      usuarioId,
      metaAhorroId,
    );

    return {
      mensaje: 'Aporte eliminado correctamente',
      aporte: {
        id: aporteId,
        eliminado: true,
        eliminadoEn: fechaEliminacion,
      },
      meta: metaActualizada.meta,
    };
  }

  private buscarMetaPropiaActiva(usuarioId: number, metaAhorroId: number) {
    return this.prismaService.metaAhorro.findFirst({
      where: {
        id: metaAhorroId,
        usuarioId,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        montoObjetivo: true,
        fechaObjetivo: true,
        activo: true,
        creadoEn: true,
        actualizadoEn: true,
      },
    });
  }

  private obtenerEstadoMeta(
    sinAportes: boolean,
    objetivoAlcanzado: boolean,
    fechaObjetivo: Date,
    fechaActual: Date,
  ): EstadoMetaAhorro {
    if (objetivoAlcanzado) {
      return 'COMPLETADA';
    }

    if (fechaObjetivo.getTime() < fechaActual.getTime()) {
      return 'VENCIDA';
    }

    if (sinAportes) {
      return 'SIN_APORTES';
    }

    return 'EN_PROGRESO';
  }

  private calcularDiasRestantes(
    fechaObjetivo: Date,
    fechaActual: Date,
  ): number {
    const diferencia = fechaObjetivo.getTime() - fechaActual.getTime();

    return Math.max(0, Math.floor(diferencia / MILISEGUNDOS_POR_DIA));
  }

  private validarFechaObjetivoNoPasada(fechaObjetivo: string): void {
    const fechaSolicitada = this.convertirFechaTexto(fechaObjetivo);

    const fechaActual = this.obtenerFechaActualEcuador();

    if (fechaSolicitada.getTime() < fechaActual.getTime()) {
      throw new BadRequestException(
        'La fecha objetivo debe ser igual o posterior a la fecha actual',
      );
    }
  }

  private convertirFechaTexto(fecha: string): Date {
    return new Date(`${fecha}T00:00:00.000Z`);
  }

  private formatearFecha(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  private obtenerFechaActualEcuador(): Date {
    const ahoraEcuador = new Date(
      Date.now() + DESFASE_HORARIO_ECUADOR_EN_HORAS * MILISEGUNDOS_POR_HORA,
    );

    const fechaActual = new Date(0);

    fechaActual.setUTCFullYear(
      ahoraEcuador.getUTCFullYear(),
      ahoraEcuador.getUTCMonth(),
      ahoraEcuador.getUTCDate(),
    );

    fechaActual.setUTCHours(0, 0, 0, 0);

    return fechaActual;
  }
}
