import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { TipoMovimiento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarMovimientoDto } from './dto/actualizar-movimiento.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { FiltrarMovimientosDto } from './dto/filtrar-movimientos.dto';

const DESFASE_HORARIO_APLICACION = '-05:00';

@Injectable()
export class MovimientosService {
  constructor(private readonly prismaService: PrismaService) {}

  async crear(usuarioId: number, crearMovimientoDto: CrearMovimientoDto) {
    const categoria = await this.prismaService.categoria.findUnique({
      where: {
        id: crearMovimientoDto.categoriaId,
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

    if (categoria.tipo !== crearMovimientoDto.tipo) {
      throw new BadRequestException(
        `La categoría seleccionada pertenece al tipo ${categoria.tipo}`,
      );
    }

    const movimiento = await this.prismaService.movimiento.create({
      data: {
        tipo: crearMovimientoDto.tipo,
        monto: crearMovimientoDto.monto,
        descripcion: crearMovimientoDto.descripcion ?? null,
        fecha: crearMovimientoDto.fecha
          ? this.convertirFechaMovimiento(crearMovimientoDto.fecha)
          : new Date(),
        usuarioId,
        categoriaId: crearMovimientoDto.categoriaId,
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
      mensaje: 'Movimiento registrado correctamente',
      movimiento: {
        ...movimiento,
        monto: movimiento.monto.toFixed(2),
      },
    };
  }

  async listarDelUsuario(usuarioId: number, filtros: FiltrarMovimientosDto) {
    const fechaDesde = filtros.fechaDesde
      ? this.convertirFechaInicial(filtros.fechaDesde)
      : undefined;

    const fechaHasta = filtros.fechaHasta
      ? this.convertirFechaFinal(filtros.fechaHasta)
      : undefined;

    if (
      fechaDesde !== undefined &&
      fechaHasta !== undefined &&
      fechaDesde.getTime() > fechaHasta.getTime()
    ) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la fecha final',
      );
    }

    const movimientos = await this.prismaService.movimiento.findMany({
      where: {
        usuarioId,

        // Excluye movimientos eliminados lógicamente.
        eliminadoEn: null,

        ...(filtros.tipo !== undefined
          ? {
              tipo: filtros.tipo,
            }
          : {}),

        ...(filtros.categoriaId !== undefined
          ? {
              categoriaId: filtros.categoriaId,
            }
          : {}),

        ...(fechaDesde !== undefined || fechaHasta !== undefined
          ? {
              fecha: {
                ...(fechaDesde !== undefined
                  ? {
                      gte: fechaDesde,
                    }
                  : {}),

                ...(fechaHasta !== undefined
                  ? {
                      lte: fechaHasta,
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [
        {
          fecha: 'desc',
        },
        {
          id: 'desc',
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

    return {
      total: movimientos.length,
      movimientos: movimientos.map((movimiento) => ({
        ...movimiento,
        monto: movimiento.monto.toFixed(2),
      })),
    };
  }

  async obtenerPorId(usuarioId: number, movimientoId: number) {
    const movimiento = await this.prismaService.movimiento.findFirst({
      where: {
        id: movimientoId,
        usuarioId,
        eliminadoEn: null,
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

    if (!movimiento) {
      throw new NotFoundException(
        'El movimiento no existe o no pertenece al usuario autenticado',
      );
    }

    return {
      movimiento: {
        ...movimiento,
        monto: movimiento.monto.toFixed(2),
      },
    };
  }

  async actualizar(
    usuarioId: number,
    movimientoId: number,
    actualizarMovimientoDto: ActualizarMovimientoDto,
  ) {
    this.validarQueExistaUnCampo(actualizarMovimientoDto);

    const movimientoActual = await this.prismaService.movimiento.findFirst({
      where: {
        id: movimientoId,
        usuarioId,
        eliminadoEn: null,
      },
      select: {
        id: true,
        tipo: true,
        categoriaId: true,
      },
    });

    if (!movimientoActual) {
      throw new NotFoundException(
        'El movimiento no existe o no pertenece al usuario autenticado',
      );
    }

    const tipoFinal = actualizarMovimientoDto.tipo ?? movimientoActual.tipo;

    const categoriaIdFinal =
      actualizarMovimientoDto.categoriaId ?? movimientoActual.categoriaId;

    if (
      actualizarMovimientoDto.tipo !== undefined ||
      actualizarMovimientoDto.categoriaId !== undefined
    ) {
      await this.validarCategoria(categoriaIdFinal, tipoFinal);
    }

    const movimientoActualizado = await this.prismaService.movimiento.update({
      where: {
        id: movimientoId,
        usuarioId,
        eliminadoEn: null,
      },
      data: {
        ...(actualizarMovimientoDto.tipo !== undefined
          ? {
              tipo: actualizarMovimientoDto.tipo,
            }
          : {}),

        ...(actualizarMovimientoDto.categoriaId !== undefined
          ? {
              categoriaId: actualizarMovimientoDto.categoriaId,
            }
          : {}),

        ...(actualizarMovimientoDto.monto !== undefined
          ? {
              monto: actualizarMovimientoDto.monto,
            }
          : {}),

        ...(actualizarMovimientoDto.descripcion !== undefined
          ? {
              descripcion: actualizarMovimientoDto.descripcion,
            }
          : {}),

        ...(actualizarMovimientoDto.fecha !== undefined
          ? {
              fecha: this.convertirFechaMovimiento(
                actualizarMovimientoDto.fecha,
              ),
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
      mensaje: 'Movimiento actualizado correctamente',
      movimiento: {
        ...movimientoActualizado,
        monto: movimientoActualizado.monto.toFixed(2),
      },
    };
  }

  async eliminar(usuarioId: number, movimientoId: number) {
    const resultado = await this.prismaService.movimiento.updateMany({
      where: {
        id: movimientoId,
        usuarioId,
        eliminadoEn: null,
      },
      data: {
        eliminadoEn: new Date(),
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException(
        'El movimiento no existe, no pertenece al usuario autenticado o ya fue eliminado',
      );
    }

    return {
      mensaje: 'Movimiento eliminado correctamente',
    };
  }

  private validarQueExistaUnCampo(
    actualizarMovimientoDto: ActualizarMovimientoDto,
  ): void {
    const tieneAlMenosUnCampo =
      actualizarMovimientoDto.tipo !== undefined ||
      actualizarMovimientoDto.categoriaId !== undefined ||
      actualizarMovimientoDto.monto !== undefined ||
      actualizarMovimientoDto.descripcion !== undefined ||
      actualizarMovimientoDto.fecha !== undefined;

    if (!tieneAlMenosUnCampo) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }
  }

  private async validarCategoria(
    categoriaId: number,
    tipoMovimiento: TipoMovimiento,
  ): Promise<void> {
    const categoria = await this.prismaService.categoria.findUnique({
      where: {
        id: categoriaId,
      },
      select: {
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

    if (categoria.tipo !== tipoMovimiento) {
      throw new BadRequestException(
        `La categoría seleccionada pertenece al tipo ${categoria.tipo}`,
      );
    }
  }

  private convertirFechaMovimiento(fecha: string): Date {
    return new Date(`${fecha}T00:00:00.000${DESFASE_HORARIO_APLICACION}`);
  }

  private convertirFechaInicial(fecha: string): Date {
    return new Date(`${fecha}T00:00:00.000${DESFASE_HORARIO_APLICACION}`);
  }

  private convertirFechaFinal(fecha: string): Date {
    return new Date(`${fecha}T23:59:59.999${DESFASE_HORARIO_APLICACION}`);
  }
}
