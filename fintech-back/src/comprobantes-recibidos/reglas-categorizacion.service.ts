import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarReglaCategorizacionDto } from './dto/actualizar-regla-categorizacion.dto';
import { CrearReglaCategorizacionDto } from './dto/crear-regla-categorizacion.dto';
import { FiltrarReglasCategorizacionDto } from './dto/filtrar-reglas-categorizacion.dto';
import { AlcanceRegla } from './interfaces/alcance-regla.enum';

type RolUsuarioAutenticado = 'USUARIO' | 'ADMINISTRADOR';

@Injectable()
export class ReglasCategorizacionService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar(usuarioId: number, filtros: FiltrarReglasCategorizacionDto) {
    const reglas = await this.prismaService.reglaCategorizacion.findMany({
      where: {
        ...(filtros.alcance === AlcanceRegla.GLOBAL ? { usuarioId: null } : {}),
        ...(filtros.alcance === AlcanceRegla.PERSONAL ? { usuarioId } : {}),
        ...(filtros.alcance === undefined
          ? { OR: [{ usuarioId: null }, { usuarioId }] }
          : {}),
      },
      orderBy: [{ usuarioId: 'asc' }, { prioridad: 'desc' }, { id: 'asc' }],
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    return {
      total: reglas.length,
      reglas: reglas.map((regla) => this.presentar(regla)),
    };
  }

  async crear(
    usuarioId: number,
    rol: RolUsuarioAutenticado,
    dto: CrearReglaCategorizacionDto,
  ) {
    if (dto.alcance === AlcanceRegla.GLOBAL && rol !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        'Solo un administrador puede crear reglas globales',
      );
    }

    // El usuarioId de una regla PERSONAL siempre es el del solicitante:
    // nunca se confía en un valor enviado por el cliente.
    const usuarioIdRegla =
      dto.alcance === AlcanceRegla.PERSONAL ? usuarioId : null;

    await this.validarCategoriaGasto(dto.categoriaId);
    await this.validarSinDuplicado(usuarioIdRegla, dto.palabraClave);

    const regla = await this.prismaService.reglaCategorizacion.create({
      data: {
        usuarioId: usuarioIdRegla,
        palabraClave: dto.palabraClave,
        categoriaId: dto.categoriaId,
        prioridad: dto.prioridad ?? 0,
        activa: dto.activa ?? true,
      },
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    return {
      mensaje: 'Regla de categorización creada correctamente',
      regla: this.presentar(regla),
    };
  }

  async actualizar(
    usuarioId: number,
    rol: RolUsuarioAutenticado,
    reglaId: number,
    dto: ActualizarReglaCategorizacionDto,
  ) {
    const regla = await this.buscarPropiaOGlobalSiEsAdmin(
      usuarioId,
      rol,
      reglaId,
    );

    if (dto.categoriaId !== undefined) {
      await this.validarCategoriaGasto(dto.categoriaId);
    }

    if (dto.palabraClave !== undefined) {
      await this.validarSinDuplicado(
        regla.usuarioId,
        dto.palabraClave,
        reglaId,
      );
    }

    const actualizada = await this.prismaService.reglaCategorizacion.update({
      where: { id: reglaId },
      data: {
        ...(dto.palabraClave !== undefined
          ? { palabraClave: dto.palabraClave }
          : {}),
        ...(dto.categoriaId !== undefined
          ? { categoriaId: dto.categoriaId }
          : {}),
        ...(dto.prioridad !== undefined ? { prioridad: dto.prioridad } : {}),
        ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
      },
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    return {
      mensaje: 'Regla de categorización actualizada correctamente',
      regla: this.presentar(actualizada),
    };
  }

  async eliminar(
    usuarioId: number,
    rol: RolUsuarioAutenticado,
    reglaId: number,
  ) {
    await this.buscarPropiaOGlobalSiEsAdmin(usuarioId, rol, reglaId);

    await this.prismaService.reglaCategorizacion.delete({
      where: { id: reglaId },
    });

    return { mensaje: 'Regla de categorización eliminada correctamente' };
  }

  private async buscarPropiaOGlobalSiEsAdmin(
    usuarioId: number,
    rol: RolUsuarioAutenticado,
    reglaId: number,
  ) {
    const regla = await this.prismaService.reglaCategorizacion.findUnique({
      where: { id: reglaId },
    });

    if (!regla) {
      throw new NotFoundException('La regla de categorización no existe');
    }

    const esPropia = regla.usuarioId === usuarioId;
    const esGlobalYSoyAdmin =
      regla.usuarioId === null && rol === 'ADMINISTRADOR';

    if (!esPropia && !esGlobalYSoyAdmin) {
      throw new ForbiddenException(
        'No tiene permisos para modificar esta regla',
      );
    }

    return regla;
  }

  private async validarSinDuplicado(
    usuarioId: number | null,
    palabraClave: string,
    excluirReglaId?: number,
  ): Promise<void> {
    const duplicada = await this.prismaService.reglaCategorizacion.findFirst({
      where: {
        usuarioId,
        palabraClave: { equals: palabraClave, mode: 'insensitive' },
        ...(excluirReglaId !== undefined
          ? { id: { not: excluirReglaId } }
          : {}),
      },
    });

    if (duplicada) {
      throw new ForbiddenException(
        'Ya existe una regla con esa palabra clave en este alcance',
      );
    }
  }

  private async validarCategoriaGasto(categoriaId: number): Promise<void> {
    const categoria = await this.prismaService.categoria.findUnique({
      where: { id: categoriaId },
      select: { tipo: true, activa: true },
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
        'Solo se pueden usar categorías de tipo GASTO en una regla de categorización',
      );
    }
  }

  private presentar(regla: {
    id: number;
    palabraClave: string;
    prioridad: number;
    activa: boolean;
    origen: string;
    usuarioId: number | null;
    categoria: { id: number; nombre: string };
  }) {
    return {
      id: regla.id,
      palabraClave: regla.palabraClave,
      prioridad: regla.prioridad,
      activa: regla.activa,
      origen: regla.origen,
      alcance:
        regla.usuarioId === null ? AlcanceRegla.GLOBAL : AlcanceRegla.PERSONAL,
      categoria: regla.categoria,
    };
  }
}
