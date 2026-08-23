import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prismaService: PrismaService) {}

  async listarDelUsuario(usuarioId: number) {
    const [proveedores, agregados] = await Promise.all([
      this.prismaService.proveedor.findMany({
        where: { usuarioId },
        orderBy: { razonSocial: 'asc' },
      }),
      this.prismaService.comprobanteRecibido.groupBy({
        by: ['proveedorId'],
        where: { usuarioId },
        _count: { _all: true },
        _sum: { importeTotal: true },
        _max: { fechaEmision: true },
      }),
    ]);

    const agregadosPorProveedor = new Map(
      agregados.map((item) => [item.proveedorId, item]),
    );

    return {
      total: proveedores.length,
      proveedores: proveedores.map((proveedor) =>
        this.presentar(proveedor, agregadosPorProveedor.get(proveedor.id)),
      ),
    };
  }

  async obtenerUno(usuarioId: number, proveedorId: number) {
    const proveedor = await this.prismaService.proveedor.findFirst({
      where: { id: proveedorId, usuarioId },
    });

    if (!proveedor) {
      throw new NotFoundException(
        'El proveedor no existe o no pertenece al usuario autenticado',
      );
    }

    const agregado = await this.prismaService.comprobanteRecibido.aggregate({
      where: { usuarioId, proveedorId },
      _count: { _all: true },
      _sum: { importeTotal: true },
      _max: { fechaEmision: true },
    });

    return {
      proveedor: this.presentar(proveedor, {
        _count: agregado._count,
        _sum: agregado._sum,
        _max: agregado._max,
      }),
    };
  }

  private presentar(
    proveedor: {
      id: number;
      ruc: string;
      razonSocial: string;
      nombreComercial: string | null;
      activo: boolean;
    },
    agregado?: {
      _count: { _all: number };
      _sum: { importeTotal: unknown };
      _max: { fechaEmision: Date | null };
    },
  ) {
    const totalGastado = agregado?._sum.importeTotal;

    return {
      ...proveedor,
      totalComprobantes: agregado?._count._all ?? 0,
      totalGastado:
        totalGastado &&
        typeof (totalGastado as { toFixed?: unknown }).toFixed === 'function'
          ? (totalGastado as { toFixed: (n: number) => string }).toFixed(2)
          : '0.00',
      ultimaCompra: agregado?._max.fechaEmision ?? null,
    };
  }
}
