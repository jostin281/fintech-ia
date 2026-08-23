import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPresupuestoDto } from './dto/actualizar-presupuesto.dto';
import { CrearPresupuestoDto } from './dto/crear-presupuesto.dto';
import { FiltrarPresupuestosDto } from './dto/filtrar-presupuestos.dto';

const DESFASE_HORARIO_APLICACION_EN_HORAS = -5;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;
const HORA_UTC_DE_MEDIANOCHE_ECUADOR = 5;
const PORCENTAJE_ALERTA_PREDETERMINADO = 80;

type EstadoPresupuesto =
  | 'SIN_CONSUMO'
  | 'DENTRO_DEL_LIMITE'
  | 'EN_ALERTA'
  | 'LIMITE_ALCANZADO'
  | 'EXCEDIDO';

@Injectable()
export class PresupuestosService {
  constructor(private readonly prismaService: PrismaService) {}

  async crear(usuarioId: number, crearPresupuestoDto: CrearPresupuestoDto) {
    this.validarPeriodoNoPasado(
      crearPresupuestoDto.mes,
      crearPresupuestoDto.anio,
    );

    const categoria = await this.prismaService.categoria.findUnique({
      where: {
        id: crearPresupuestoDto.categoriaId,
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        activa: true,
      },
    });

    if (!categoria) {
      throw new NotFoundException('La categoría seleccionada no existe');
    }

    if (!categoria.activa) {
      throw new BadRequestException(
        'La categoría seleccionada está desactivada',
      );
    }

    if (categoria.tipo !== 'GASTO') {
      throw new BadRequestException(
        'Los presupuestos solamente pueden utilizar categorías de tipo GASTO',
      );
    }

    const presupuestoExistente =
      await this.prismaService.presupuesto.findUnique({
        where: {
          usuarioId_categoriaId_anio_mes: {
            usuarioId,
            categoriaId: crearPresupuestoDto.categoriaId,
            anio: crearPresupuestoDto.anio,
            mes: crearPresupuestoDto.mes,
          },
        },
        select: {
          id: true,
          activo: true,
        },
      });

    if (presupuestoExistente?.activo) {
      throw new ConflictException(
        'Ya existe un presupuesto para esta categoría, mes y año',
      );
    }

    /*
     * Si el presupuesto existía, pero fue eliminado
     * lógicamente, se reactiva el mismo registro.
     */
    if (presupuestoExistente) {
      const presupuesto = await this.prismaService.presupuesto.update({
        where: {
          id: presupuestoExistente.id,
        },
        data: {
          montoLimite: crearPresupuestoDto.montoLimite,
          porcentajeAlerta:
            crearPresupuestoDto.porcentajeAlerta ??
            PORCENTAJE_ALERTA_PREDETERMINADO,
          activo: true,
        },
        include: {
          categoria: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
            },
          },
        },
      });

      return {
        mensaje: 'Presupuesto creado correctamente',
        presupuesto: {
          id: presupuesto.id,
          montoLimite: presupuesto.montoLimite.toFixed(2),
          mes: presupuesto.mes,
          anio: presupuesto.anio,
          porcentajeAlerta: presupuesto.porcentajeAlerta,
          activo: presupuesto.activo,
          creadoEn: presupuesto.creadoEn,
          actualizadoEn: presupuesto.actualizadoEn,
          categoria: presupuesto.categoria,
        },
      };
    }

    try {
      const presupuesto = await this.prismaService.presupuesto.create({
        data: {
          montoLimite: crearPresupuestoDto.montoLimite,
          mes: crearPresupuestoDto.mes,
          anio: crearPresupuestoDto.anio,
          activo: true,
          usuarioId,
          categoriaId: crearPresupuestoDto.categoriaId,

          ...(crearPresupuestoDto.porcentajeAlerta !== undefined
            ? {
                porcentajeAlerta: crearPresupuestoDto.porcentajeAlerta,
              }
            : {}),
        },
        include: {
          categoria: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
            },
          },
        },
      });

      return {
        mensaje: 'Presupuesto creado correctamente',
        presupuesto: {
          id: presupuesto.id,
          montoLimite: presupuesto.montoLimite.toFixed(2),
          mes: presupuesto.mes,
          anio: presupuesto.anio,
          porcentajeAlerta: presupuesto.porcentajeAlerta,
          activo: presupuesto.activo,
          creadoEn: presupuesto.creadoEn,
          actualizadoEn: presupuesto.actualizadoEn,
          categoria: presupuesto.categoria,
        },
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe un presupuesto para esta categoría, mes y año',
        );
      }

      throw error;
    }
  }

  async listarDelUsuario(usuarioId: number, filtros: FiltrarPresupuestosDto) {
    const periodo = this.obtenerPeriodo(filtros);

    const presupuestos = await this.prismaService.presupuesto.findMany({
      where: {
        usuarioId,
        mes: periodo.mes,
        anio: periodo.anio,
        activo: true,
      },
      orderBy: [
        {
          categoriaId: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      include: {
        categoria: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    });

    const presupuestoReferencia = presupuestos[0];

    if (presupuestoReferencia === undefined) {
      return {
        periodo,
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

    const rango = this.obtenerRangoPeriodo(periodo.mes, periodo.anio);

    const categoriaIds = presupuestos.map(
      (presupuesto) => presupuesto.categoriaId,
    );

    const consumos = await this.prismaService.movimiento.groupBy({
      by: ['categoriaId'],
      where: {
        usuarioId,
        tipo: 'GASTO',
        categoriaId: {
          in: categoriaIds,
        },
        fecha: {
          gte: rango.fechaDesde,
          lt: rango.fechaHastaExclusiva,
        },
        eliminadoEn: null,
      },
      _sum: {
        monto: true,
      },
    });

    const consumosPorCategoria = new Map(
      consumos.map(
        (consumo) => [consumo.categoriaId, consumo._sum.monto] as const,
      ),
    );

    const montoCero = presupuestoReferencia.montoLimite.minus(
      presupuestoReferencia.montoLimite,
    );

    let montoTotalPresupuestado = montoCero;
    let montoTotalGastado = montoCero;
    let presupuestosEnAlerta = 0;
    let presupuestosExcedidos = 0;

    const presupuestosCalculados = presupuestos.map((presupuesto) => {
      const montoGastado =
        consumosPorCategoria.get(presupuesto.categoriaId) ?? montoCero;

      const saldoDisponible = presupuesto.montoLimite.minus(montoGastado);

      const porcentajeUtilizado = montoGastado
        .dividedBy(presupuesto.montoLimite)
        .times(100);

      let estado: EstadoPresupuesto;

      if (montoGastado.isZero()) {
        estado = 'SIN_CONSUMO';
      } else if (montoGastado.greaterThan(presupuesto.montoLimite)) {
        estado = 'EXCEDIDO';
        presupuestosExcedidos += 1;
      } else if (montoGastado.equals(presupuesto.montoLimite)) {
        estado = 'LIMITE_ALCANZADO';
        presupuestosEnAlerta += 1;
      } else if (
        montoGastado
          .times(100)
          .greaterThanOrEqualTo(
            presupuesto.montoLimite.times(presupuesto.porcentajeAlerta),
          )
      ) {
        estado = 'EN_ALERTA';
        presupuestosEnAlerta += 1;
      } else {
        estado = 'DENTRO_DEL_LIMITE';
      }

      montoTotalPresupuestado = montoTotalPresupuestado.plus(
        presupuesto.montoLimite,
      );

      montoTotalGastado = montoTotalGastado.plus(montoGastado);

      return {
        id: presupuesto.id,
        montoLimite: presupuesto.montoLimite.toFixed(2),
        montoGastado: montoGastado.toFixed(2),
        saldoDisponible: saldoDisponible.toFixed(2),
        porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
        porcentajeAlerta: presupuesto.porcentajeAlerta,
        estado,
        mes: presupuesto.mes,
        anio: presupuesto.anio,
        activo: presupuesto.activo,
        creadoEn: presupuesto.creadoEn,
        actualizadoEn: presupuesto.actualizadoEn,
        categoria: presupuesto.categoria,
      };
    });

    const porcentajeTotalUtilizado = montoTotalPresupuestado.isZero()
      ? 0
      : Number(
          montoTotalGastado
            .dividedBy(montoTotalPresupuestado)
            .times(100)
            .toFixed(2),
        );

    return {
      periodo,
      total: presupuestosCalculados.length,
      resumen: {
        montoPresupuestado: montoTotalPresupuestado.toFixed(2),
        montoGastado: montoTotalGastado.toFixed(2),
        saldoDisponible: montoTotalPresupuestado
          .minus(montoTotalGastado)
          .toFixed(2),
        porcentajeUtilizado: porcentajeTotalUtilizado,
        presupuestosEnAlerta,
        presupuestosExcedidos,
      },
      presupuestos: presupuestosCalculados,
    };
  }

  async obtenerUnoDelUsuario(usuarioId: number, presupuestoId: number) {
    const presupuesto = await this.prismaService.presupuesto.findFirst({
      where: {
        id: presupuestoId,
        usuarioId,
        activo: true,
      },
      include: {
        categoria: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    });

    if (!presupuesto) {
      throw new NotFoundException('El presupuesto solicitado no existe');
    }

    const rango = this.obtenerRangoPeriodo(presupuesto.mes, presupuesto.anio);

    const consumo = await this.prismaService.movimiento.aggregate({
      where: {
        usuarioId,
        categoriaId: presupuesto.categoriaId,
        tipo: 'GASTO',
        fecha: {
          gte: rango.fechaDesde,
          lt: rango.fechaHastaExclusiva,
        },
        eliminadoEn: null,
      },
      _sum: {
        monto: true,
      },
    });

    const montoCero = presupuesto.montoLimite.minus(presupuesto.montoLimite);

    const montoGastado = consumo._sum.monto ?? montoCero;

    const saldoDisponible = presupuesto.montoLimite.minus(montoGastado);

    const porcentajeUtilizado = montoGastado
      .dividedBy(presupuesto.montoLimite)
      .times(100);

    let estado: EstadoPresupuesto;

    if (montoGastado.isZero()) {
      estado = 'SIN_CONSUMO';
    } else if (montoGastado.greaterThan(presupuesto.montoLimite)) {
      estado = 'EXCEDIDO';
    } else if (montoGastado.equals(presupuesto.montoLimite)) {
      estado = 'LIMITE_ALCANZADO';
    } else if (
      montoGastado
        .times(100)
        .greaterThanOrEqualTo(
          presupuesto.montoLimite.times(presupuesto.porcentajeAlerta),
        )
    ) {
      estado = 'EN_ALERTA';
    } else {
      estado = 'DENTRO_DEL_LIMITE';
    }

    return {
      presupuesto: {
        id: presupuesto.id,
        montoLimite: presupuesto.montoLimite.toFixed(2),
        montoGastado: montoGastado.toFixed(2),
        saldoDisponible: saldoDisponible.toFixed(2),
        porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
        porcentajeAlerta: presupuesto.porcentajeAlerta,
        estado,
        mes: presupuesto.mes,
        anio: presupuesto.anio,
        activo: presupuesto.activo,
        creadoEn: presupuesto.creadoEn,
        actualizadoEn: presupuesto.actualizadoEn,
        categoria: presupuesto.categoria,
      },
    };
  }

  async actualizar(
    usuarioId: number,
    presupuestoId: number,
    actualizarPresupuestoDto: ActualizarPresupuestoDto,
  ) {
    const noEnvioMonto = actualizarPresupuestoDto.montoLimite === undefined;

    const noEnvioPorcentaje =
      actualizarPresupuestoDto.porcentajeAlerta === undefined;

    if (noEnvioMonto && noEnvioPorcentaje) {
      throw new BadRequestException(
        'Debe enviar al menos el monto límite o el porcentaje de alerta',
      );
    }

    const resultado = await this.prismaService.presupuesto.updateMany({
      where: {
        id: presupuestoId,
        usuarioId,
        activo: true,
      },
      data: {
        ...(actualizarPresupuestoDto.montoLimite !== undefined
          ? {
              montoLimite: actualizarPresupuestoDto.montoLimite,
            }
          : {}),

        ...(actualizarPresupuestoDto.porcentajeAlerta !== undefined
          ? {
              porcentajeAlerta: actualizarPresupuestoDto.porcentajeAlerta,
            }
          : {}),
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('El presupuesto solicitado no existe');
    }

    const presupuestoActualizado = await this.obtenerUnoDelUsuario(
      usuarioId,
      presupuestoId,
    );

    return {
      mensaje: 'Presupuesto actualizado correctamente',
      presupuesto: presupuestoActualizado.presupuesto,
    };
  }

  async eliminar(usuarioId: number, presupuestoId: number) {
    const resultado = await this.prismaService.presupuesto.updateMany({
      where: {
        id: presupuestoId,
        usuarioId,
        activo: true,
      },
      data: {
        activo: false,
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('El presupuesto solicitado no existe');
    }

    return {
      mensaje: 'Presupuesto eliminado correctamente',
      presupuesto: {
        id: presupuestoId,
        activo: false,
      },
    };
  }

  private obtenerPeriodo(filtros: FiltrarPresupuestosDto): {
    mes: number;
    anio: number;
  } {
    const envioSolamenteMes =
      filtros.mes !== undefined && filtros.anio === undefined;

    const envioSolamenteAnio =
      filtros.mes === undefined && filtros.anio !== undefined;

    if (envioSolamenteMes || envioSolamenteAnio) {
      throw new BadRequestException('Debe enviar juntos el mes y el año');
    }

    if (filtros.mes !== undefined && filtros.anio !== undefined) {
      return {
        mes: filtros.mes,
        anio: filtros.anio,
      };
    }

    return this.obtenerPeriodoActual();
  }

  private obtenerPeriodoActual(): {
    mes: number;
    anio: number;
  } {
    const fechaActualEcuador = new Date(
      Date.now() + DESFASE_HORARIO_APLICACION_EN_HORAS * MILISEGUNDOS_POR_HORA,
    );

    return {
      mes: fechaActualEcuador.getUTCMonth() + 1,
      anio: fechaActualEcuador.getUTCFullYear(),
    };
  }

  private obtenerRangoPeriodo(
    mes: number,
    anio: number,
  ): {
    fechaDesde: Date;
    fechaHastaExclusiva: Date;
  } {
    const fechaDesde = new Date(0);

    fechaDesde.setUTCFullYear(anio, mes - 1, 1);

    fechaDesde.setUTCHours(HORA_UTC_DE_MEDIANOCHE_ECUADOR, 0, 0, 0);

    const fechaHastaExclusiva = new Date(0);

    fechaHastaExclusiva.setUTCFullYear(anio, mes, 1);

    fechaHastaExclusiva.setUTCHours(HORA_UTC_DE_MEDIANOCHE_ECUADOR, 0, 0, 0);

    return {
      fechaDesde,
      fechaHastaExclusiva,
    };
  }

  private validarPeriodoNoPasado(mes: number, anio: number): void {
    const periodoActual = this.obtenerPeriodoActual();

    const periodoSolicitado = anio * 100 + mes;

    const periodoActualNumerico = periodoActual.anio * 100 + periodoActual.mes;

    if (periodoSolicitado < periodoActualNumerico) {
      throw new BadRequestException(
        'Solo puede crear presupuestos para el mes actual o meses futuros',
      );
    }
  }

  private esViolacionDeRestriccionUnica(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
