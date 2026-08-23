import { Injectable, NotFoundException } from '@nestjs/common';

import { TipoNotificacion } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto';

const DESFASE_HORARIO_ECUADOR_EN_HORAS = -5;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_AVISO_META = 7;

export interface CrearNotificacionInterna {
  usuarioId: number;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  referencia: string;
}

type NotificacionPendiente = CrearNotificacionInterna;

@Injectable()
export class NotificacionesService {
  constructor(private readonly prismaService: PrismaService) {}

  async sincronizarAlertas(usuarioId: number) {
    const [alertasPresupuestos, alertasMetas] = await Promise.all([
      this.construirAlertasPresupuestos(usuarioId),
      this.construirAlertasMetas(usuarioId),
    ]);

    const alertasPendientes = [...alertasPresupuestos, ...alertasMetas];

    let nuevas = 0;

    if (alertasPendientes.length > 0) {
      const resultado = await this.prismaService.notificacion.createMany({
        data: alertasPendientes,
        skipDuplicates: true,
      });

      nuevas = resultado.count;
    }

    const listado = await this.listarDelUsuario(usuarioId, {});

    return {
      mensaje: 'Alertas sincronizadas correctamente',
      nuevas,
      total: listado.total,
      noLeidas: listado.noLeidas,
      notificaciones: listado.notificaciones,
    };
  }

  async listarDelUsuario(usuarioId: number, filtros: ListarNotificacionesDto) {
    const mostrarSoloNoLeidas = filtros.soloNoLeidas === true;

    const where = {
      usuarioId,
      eliminadoEn: null,
      ...(mostrarSoloNoLeidas
        ? {
            leida: false,
          }
        : {}),
    };

    const [notificaciones, totalNoLeidas] =
      await this.prismaService.$transaction([
        this.prismaService.notificacion.findMany({
          where,
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
            titulo: true,
            mensaje: true,
            tipo: true,
            referencia: true,
            leida: true,
            leidaEn: true,
            creadoEn: true,
          },
        }),

        this.prismaService.notificacion.count({
          where: {
            usuarioId,
            eliminadoEn: null,
            leida: false,
          },
        }),
      ]);

    return {
      total: notificaciones.length,
      noLeidas: totalNoLeidas,
      notificaciones,
    };
  }

  async marcarComoLeida(usuarioId: number, notificacionId: number) {
    const notificacion = await this.buscarNotificacionPropia(
      usuarioId,
      notificacionId,
    );

    if (!notificacion) {
      throw new NotFoundException('La notificación solicitada no existe');
    }

    if (notificacion.leida) {
      return {
        mensaje: 'La notificación ya estaba marcada como leída',
        notificacion,
      };
    }

    const notificacionActualizada =
      await this.prismaService.notificacion.update({
        where: {
          id: notificacionId,
        },
        data: {
          leida: true,
          leidaEn: new Date(),
        },
        select: {
          id: true,
          titulo: true,
          mensaje: true,
          tipo: true,
          referencia: true,
          leida: true,
          leidaEn: true,
          creadoEn: true,
        },
      });

    return {
      mensaje: 'Notificación marcada como leída',
      notificacion: notificacionActualizada,
    };
  }

  async marcarTodasComoLeidas(usuarioId: number) {
    const fechaLectura = new Date();

    const resultado = await this.prismaService.notificacion.updateMany({
      where: {
        usuarioId,
        eliminadoEn: null,
        leida: false,
      },
      data: {
        leida: true,
        leidaEn: fechaLectura,
      },
    });

    return {
      mensaje: 'Notificaciones marcadas como leídas',
      actualizadas: resultado.count,
      leidaEn: fechaLectura,
    };
  }

  async eliminar(usuarioId: number, notificacionId: number) {
    const fechaEliminacion = new Date();

    const resultado = await this.prismaService.notificacion.updateMany({
      where: {
        id: notificacionId,
        usuarioId,
        eliminadoEn: null,
      },
      data: {
        eliminadoEn: fechaEliminacion,
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('La notificación solicitada no existe');
    }

    return {
      mensaje: 'Notificación eliminada correctamente',
      notificacion: {
        id: notificacionId,
        eliminada: true,
        eliminadoEn: fechaEliminacion,
      },
    };
  }

  async crearInterna(datos: CrearNotificacionInterna): Promise<boolean> {
    const resultado = await this.prismaService.notificacion.createMany({
      data: [datos],
      skipDuplicates: true,
    });

    return resultado.count === 1;
  }

  private buscarNotificacionPropia(usuarioId: number, notificacionId: number) {
    return this.prismaService.notificacion.findFirst({
      where: {
        id: notificacionId,
        usuarioId,
        eliminadoEn: null,
      },
      select: {
        id: true,
        titulo: true,
        mensaje: true,
        tipo: true,
        referencia: true,
        leida: true,
        leidaEn: true,
        creadoEn: true,
      },
    });
  }

  private async construirAlertasPresupuestos(
    usuarioId: number,
  ): Promise<NotificacionPendiente[]> {
    const fechaActual = this.obtenerFechaActualEcuador();

    const anio = fechaActual.getUTCFullYear();

    const mes = fechaActual.getUTCMonth() + 1;

    const rango = this.construirRangoMensual(anio, mes);

    const presupuestos = await this.prismaService.presupuesto.findMany({
      where: {
        usuarioId,
        anio,
        mes,
        activo: true,
      },
      select: {
        id: true,
        montoLimite: true,
        porcentajeAlerta: true,
        categoriaId: true,
        categoria: {
          select: {
            nombre: true,
          },
        },
      },
    });

    if (presupuestos.length === 0) {
      return [];
    }

    const categoriaIds = presupuestos.map(
      (presupuesto) => presupuesto.categoriaId,
    );

    const gastosAgrupados = await this.prismaService.movimiento.groupBy({
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

    const gastosPorCategoria = new Map(
      gastosAgrupados.map(
        (grupo) => [grupo.categoriaId, grupo._sum.monto] as const,
      ),
    );

    const alertas: NotificacionPendiente[] = [];

    for (const presupuesto of presupuestos) {
      const montoCero = presupuesto.montoLimite.minus(presupuesto.montoLimite);

      const montoGastado =
        gastosPorCategoria.get(presupuesto.categoriaId) ?? montoCero;

      const porcentajeConsumido = Number(
        montoGastado.dividedBy(presupuesto.montoLimite).times(100).toFixed(2),
      );

      if (porcentajeConsumido >= 100) {
        alertas.push({
          usuarioId,
          titulo: 'Presupuesto excedido',
          mensaje:
            `Has utilizado $${montoGastado.toFixed(2)} ` +
            `del presupuesto de $${presupuesto.montoLimite.toFixed(2)} ` +
            `para ${presupuesto.categoria.nombre}.`,
          tipo: TipoNotificacion.ALERTA_PRESUPUESTO,
          referencia:
            `presupuesto:${presupuesto.id}:` +
            `${anio}-${this.formatearMes(mes)}:excedido`,
        });

        continue;
      }

      if (porcentajeConsumido >= presupuesto.porcentajeAlerta) {
        alertas.push({
          usuarioId,
          titulo: 'Alerta de presupuesto',
          mensaje:
            `Has utilizado el ${porcentajeConsumido}% ` +
            `del presupuesto de ${presupuesto.categoria.nombre}.`,
          tipo: TipoNotificacion.ALERTA_PRESUPUESTO,
          referencia:
            `presupuesto:${presupuesto.id}:` +
            `${anio}-${this.formatearMes(mes)}:alerta`,
        });
      }
    }

    return alertas;
  }

  private async construirAlertasMetas(
    usuarioId: number,
  ): Promise<NotificacionPendiente[]> {
    const metas = await this.prismaService.metaAhorro.findMany({
      where: {
        usuarioId,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        montoObjetivo: true,
        fechaObjetivo: true,
      },
    });

    if (metas.length === 0) {
      return [];
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
        (grupo) => [grupo.metaAhorroId, grupo._sum.monto] as const,
      ),
    );

    const fechaActual = this.obtenerFechaActualEcuador();

    const alertas: NotificacionPendiente[] = [];

    for (const meta of metas) {
      const montoCero = meta.montoObjetivo.minus(meta.montoObjetivo);

      const montoAhorrado = aportesPorMeta.get(meta.id) ?? montoCero;

      const objetivoAlcanzado = montoAhorrado.greaterThanOrEqualTo(
        meta.montoObjetivo,
      );

      if (objetivoAlcanzado) {
        alertas.push({
          usuarioId,
          titulo: 'Meta de ahorro completada',
          mensaje:
            `Alcanzaste la meta “${meta.nombre}” ` +
            `con un total ahorrado de $${montoAhorrado.toFixed(2)}.`,
          tipo: TipoNotificacion.META_AHORRO,
          referencia: `meta:${meta.id}:completada`,
        });

        continue;
      }

      if (meta.fechaObjetivo.getTime() < fechaActual.getTime()) {
        alertas.push({
          usuarioId,
          titulo: 'Meta de ahorro vencida',
          mensaje:
            `La meta “${meta.nombre}” venció el ` +
            `${this.formatearFecha(meta.fechaObjetivo)} ` +
            `y todavía no ha sido completada.`,
          tipo: TipoNotificacion.META_AHORRO,
          referencia: `meta:${meta.id}:vencida`,
        });

        continue;
      }

      const diasRestantes = this.calcularDiasRestantes(
        meta.fechaObjetivo,
        fechaActual,
      );

      if (diasRestantes <= DIAS_AVISO_META) {
        alertas.push({
          usuarioId,
          titulo: 'Meta próxima a vencer',
          mensaje:
            `Faltan ${diasRestantes} día(s) para alcanzar ` +
            `la meta “${meta.nombre}”.`,
          tipo: TipoNotificacion.META_AHORRO,
          referencia:
            `meta:${meta.id}:proxima:` +
            `${this.formatearFecha(meta.fechaObjetivo)}`,
        });
      }
    }

    return alertas;
  }

  private construirRangoMensual(anio: number, mes: number) {
    return {
      fechaDesde: new Date(Date.UTC(anio, mes - 1, 1)),
      fechaHastaExclusiva: new Date(Date.UTC(anio, mes, 1)),
    };
  }

  private calcularDiasRestantes(
    fechaObjetivo: Date,
    fechaActual: Date,
  ): number {
    const diferencia = fechaObjetivo.getTime() - fechaActual.getTime();

    return Math.max(0, Math.floor(diferencia / MILISEGUNDOS_POR_DIA));
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

  private formatearFecha(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  private formatearMes(mes: number): string {
    return String(mes).padStart(2, '0');
  }
}
