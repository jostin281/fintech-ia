import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarProductoServicioDto } from './dto/actualizar-producto-servicio.dto';
import { CrearProductoServicioDto } from './dto/crear-producto-servicio.dto';

@Injectable()
export class ProductosServiciosService {
  constructor(private readonly prismaService: PrismaService) {}

  async crear(
    usuarioId: number,
    crearProductoServicioDto: CrearProductoServicioDto,
  ) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const productoExistente =
      await this.prismaService.productoServicioFacturacion.findUnique({
        where: {
          perfilTributarioId_codigoPrincipal: {
            perfilTributarioId: perfil.id,
            codigoPrincipal: crearProductoServicioDto.codigoPrincipal,
          },
        },
      });

    if (productoExistente?.activo) {
      throw new ConflictException(
        'Ya existe un producto o servicio con ese código',
      );
    }

    if (productoExistente) {
      const productoServicio =
        await this.prismaService.productoServicioFacturacion.update({
          where: { id: productoExistente.id },
          data: { ...crearProductoServicioDto, activo: true },
        });

      return {
        mensaje: 'Producto o servicio creado correctamente',
        productoServicio: this.presentar(productoServicio),
      };
    }

    try {
      const productoServicio =
        await this.prismaService.productoServicioFacturacion.create({
          data: {
            ...crearProductoServicioDto,
            perfilTributarioId: perfil.id,
          },
        });

      return {
        mensaje: 'Producto o servicio creado correctamente',
        productoServicio: this.presentar(productoServicio),
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe un producto o servicio con ese código',
        );
      }

      throw error;
    }
  }

  async listar(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const productos =
      await this.prismaService.productoServicioFacturacion.findMany({
        where: { perfilTributarioId: perfil.id, activo: true },
        orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
      });

    return {
      total: productos.length,
      productosServicios: productos.map((producto) => this.presentar(producto)),
    };
  }

  async obtenerUno(usuarioId: number, productoServicioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const producto =
      await this.prismaService.productoServicioFacturacion.findFirst({
        where: {
          id: productoServicioId,
          perfilTributarioId: perfil.id,
          activo: true,
        },
      });

    if (!producto) {
      throw new NotFoundException(
        'El producto o servicio solicitado no existe',
      );
    }

    return { productoServicio: this.presentar(producto) };
  }

  async actualizar(
    usuarioId: number,
    productoServicioId: number,
    actualizarProductoServicioDto: ActualizarProductoServicioDto,
  ) {
    if (Object.keys(actualizarProductoServicioDto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un dato para actualizar',
      );
    }

    const perfil = await this.obtenerPerfil(usuarioId);
    const producto =
      await this.prismaService.productoServicioFacturacion.findFirst({
        where: {
          id: productoServicioId,
          perfilTributarioId: perfil.id,
          activo: true,
        },
        select: { id: true },
      });

    if (!producto) {
      throw new NotFoundException(
        'El producto o servicio solicitado no existe',
      );
    }

    try {
      const productoActualizado =
        await this.prismaService.productoServicioFacturacion.update({
          where: { id: producto.id },
          data: actualizarProductoServicioDto,
        });

      return {
        mensaje: 'Producto o servicio actualizado correctamente',
        productoServicio: this.presentar(productoActualizado),
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe un producto o servicio con ese código',
        );
      }

      throw error;
    }
  }

  async eliminar(usuarioId: number, productoServicioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const resultado =
      await this.prismaService.productoServicioFacturacion.updateMany({
        where: {
          id: productoServicioId,
          perfilTributarioId: perfil.id,
          activo: true,
        },
        data: { activo: false },
      });

    if (resultado.count === 0) {
      throw new NotFoundException(
        'El producto o servicio solicitado no existe',
      );
    }

    return {
      mensaje: 'Producto o servicio desactivado correctamente',
      productoServicio: { id: productoServicioId, activo: false },
    };
  }

  private async obtenerPerfil(usuarioId: number) {
    const perfil = await this.prismaService.perfilTributario.findFirst({
      where: { usuarioId, activo: true },
      select: { id: true },
    });

    if (!perfil) {
      throw new NotFoundException('Primero debe crear el perfil tributario');
    }

    return perfil;
  }

  private presentar(producto: {
    id: number;
    codigoPrincipal: string;
    descripcion: string;
    precioUnitario: { toFixed(decimales: number): string };
    tarifaIva: string;
    activo: boolean;
    creadoEn: Date;
    actualizadoEn: Date;
  }) {
    return {
      id: producto.id,
      codigoPrincipal: producto.codigoPrincipal,
      descripcion: producto.descripcion,
      precioUnitario: producto.precioUnitario.toFixed(6),
      tarifaIva: producto.tarifaIva,
      porcentajeIva: producto.tarifaIva === 'QUINCE' ? 15 : 0,
      activo: producto.activo,
      creadoEn: producto.creadoEn,
      actualizadoEn: producto.actualizadoEn,
    };
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
