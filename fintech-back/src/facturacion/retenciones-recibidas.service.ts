import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { CrearRetencionRecibidaDto } from './dto/crear-retencion-recibida.dto';
import { convertirFechaIsoEcuador } from './utilidades/fecha-ecuador';

@Injectable()
export class RetencionesRecibidasService {
  constructor(private readonly prismaService: PrismaService) {}

  async crear(
    usuarioId: number,
    crearRetencionRecibidaDto: CrearRetencionRecibidaDto,
  ) {
    const perfil = await this.obtenerPerfil(usuarioId);
    this.validarCalculo(crearRetencionRecibidaDto);

    if (crearRetencionRecibidaDto.facturaId !== undefined) {
      const factura = await this.prismaService.facturaElectronica.findFirst({
        where: {
          id: crearRetencionRecibidaDto.facturaId,
          perfilTributarioId: perfil.id,
          estado: 'AUTORIZADA',
        },
        select: { id: true },
      });

      if (!factura) {
        throw new NotFoundException(
          'La factura asociada no existe o todavía no está autorizada',
        );
      }
    }

    try {
      const retencion = await this.prismaService.retencionRecibida.create({
        data: {
          tipo: crearRetencionRecibidaDto.tipo,
          emisorIdentificacion:
            crearRetencionRecibidaDto.emisorIdentificacion.trim(),
          numeroComprobante: crearRetencionRecibidaDto.numeroComprobante.trim(),
          fechaEmision: convertirFechaIsoEcuador(
            crearRetencionRecibidaDto.fechaEmision,
          ),
          baseImponible: crearRetencionRecibidaDto.baseImponible,
          porcentaje: crearRetencionRecibidaDto.porcentaje,
          valor: crearRetencionRecibidaDto.valor,
          observacion: crearRetencionRecibidaDto.observacion,
          facturaId: crearRetencionRecibidaDto.facturaId,
          perfilTributarioId: perfil.id,
        },
      });

      return {
        mensaje: 'Retención recibida registrada correctamente',
        retencion: this.presentar(retencion),
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe una retención con ese número de comprobante',
        );
      }

      throw error;
    }
  }

  async listar(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const retenciones = await this.prismaService.retencionRecibida.findMany({
      where: { perfilTributarioId: perfil.id, activo: true },
      orderBy: [{ fechaEmision: 'desc' }, { id: 'desc' }],
    });

    return {
      total: retenciones.length,
      retenciones: retenciones.map((retencion) => this.presentar(retencion)),
    };
  }

  async eliminar(usuarioId: number, retencionId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const resultado = await this.prismaService.retencionRecibida.updateMany({
      where: { id: retencionId, perfilTributarioId: perfil.id, activo: true },
      data: { activo: false },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('La retención solicitada no existe');
    }

    return {
      mensaje: 'Retención recibida desactivada correctamente',
      retencion: { id: retencionId, activo: false },
    };
  }

  private validarCalculo(dto: CrearRetencionRecibidaDto): void {
    const base = new Decimal(dto.baseImponible);
    const porcentaje = new Decimal(dto.porcentaje);
    const valor = new Decimal(dto.valor);

    if (base.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'La base imponible debe ser mayor que cero',
      );
    }

    if (porcentaje.lessThanOrEqualTo(0) || porcentaje.greaterThan(100)) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }

    const calculado = base
      .times(porcentaje)
      .dividedBy(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    if (calculado.minus(valor).abs().greaterThan('0.02')) {
      throw new BadRequestException(
        `El valor retenido no coincide con base × porcentaje. Valor esperado: ${calculado.toFixed(2)}`,
      );
    }
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

  private presentar(retencion: {
    id: number;
    tipo: string;
    emisorIdentificacion: string;
    numeroComprobante: string;
    fechaEmision: Date;
    baseImponible: { toFixed(decimales: number): string };
    porcentaje: { toFixed(decimales: number): string };
    valor: { toFixed(decimales: number): string };
    observacion: string | null;
    facturaId: number | null;
    activo: boolean;
    creadoEn: Date;
    actualizadoEn: Date;
  }) {
    return {
      id: retencion.id,
      tipo: retencion.tipo,
      emisorIdentificacion: retencion.emisorIdentificacion,
      numeroComprobante: retencion.numeroComprobante,
      fechaEmision: retencion.fechaEmision,
      baseImponible: retencion.baseImponible.toFixed(2),
      porcentaje: retencion.porcentaje.toFixed(4),
      valor: retencion.valor.toFixed(2),
      observacion: retencion.observacion,
      facturaId: retencion.facturaId,
      activo: retencion.activo,
      creadoEn: retencion.creadoEn,
      actualizadoEn: retencion.actualizadoEn,
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
