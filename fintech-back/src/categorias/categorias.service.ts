import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { ActualizarEstadoCategoriaDto } from './dto/actualizar-estado-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prismaService: PrismaService) {}

  // Consulta todas las categorías.
  async obtenerTodas() {
    const categorias = await this.prismaService.categoria.findMany({
      orderBy: {
        id: 'asc',
      },
    });

    return {
      mensaje: 'Categorías obtenidas correctamente',
      categorias,
    };
  }

  // Consulta una categoría mediante su identificador.
  async obtenerPorId(id: number) {
    const categoria = await this.prismaService.categoria.findUnique({
      where: {
        id,
      },
    });

    if (!categoria) {
      throw new NotFoundException(`No existe una categoría con el id ${id}`);
    }

    return {
      mensaje: 'Categoría obtenida correctamente',
      categoria,
    };
  }

  // Crea una categoría.
  async crear(crearCategoriaDto: CrearCategoriaDto) {
    try {
      const categoria = await this.prismaService.categoria.create({
        data: {
          nombre: crearCategoriaDto.nombre,
          tipo: crearCategoriaDto.tipo,
        },
      });

      return {
        mensaje: 'Categoría creada correctamente',
        categoria,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una categoría con el mismo nombre y tipo',
        );
      }

      throw error;
    }
  }

  // Actualiza el nombre o tipo de una categoría.
  async actualizar(id: number, actualizarCategoriaDto: ActualizarCategoriaDto) {
    if (Object.keys(actualizarCategoriaDto).length === 0) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }

    try {
      const categoria = await this.prismaService.categoria.update({
        where: {
          id,
        },
        data: {
          ...(actualizarCategoriaDto.nombre !== undefined && {
            nombre: actualizarCategoriaDto.nombre,
          }),
          ...(actualizarCategoriaDto.tipo !== undefined && {
            tipo: actualizarCategoriaDto.tipo,
          }),
        },
      });

      return {
        mensaje: 'Categoría actualizada correctamente',
        categoria,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `No existe una categoría con el id ${id}`,
          );
        }

        if (error.code === 'P2002') {
          throw new ConflictException(
            'Ya existe una categoría con el mismo nombre y tipo',
          );
        }
      }

      throw error;
    }
  }

  // Activa o desactiva una categoría sin eliminarla.
  async actualizarEstado(
    id: number,
    actualizarEstadoDto: ActualizarEstadoCategoriaDto,
  ) {
    try {
      const categoria = await this.prismaService.categoria.update({
        where: {
          id,
        },
        data: {
          activa: actualizarEstadoDto.activa,
        },
      });

      return {
        mensaje: categoria.activa
          ? 'Categoría activada correctamente'
          : 'Categoría desactivada correctamente',
        categoria,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`No existe una categoría con el id ${id}`);
      }

      throw error;
    }
  }
}
