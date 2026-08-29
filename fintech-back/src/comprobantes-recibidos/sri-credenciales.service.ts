import { ConfigService } from '@nestjs/config';
import { Injectable, NotFoundException } from '@nestjs/common';

import { obtenerClaveCifrado } from '../facturacion/utilidades/cifrado-credencial';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarAutoDescargaSriDto } from './dto/actualizar-auto-descarga-sri.dto';
import { GuardarCredencialesSriDto } from './dto/guardar-credenciales-sri.dto';
import {
  cifrarClaveSri,
  descifrarClaveSri,
} from './utilidades/cifrado-credencial-sri';

export interface EstadoCredencialSri {
  configurado: boolean;
  usuarioSri: string | null;
  ciAdicionalSri: string | null;
  autoDescargaHabilitada: boolean;
  ultimaEjecucionEn: Date | null;
  ultimoResultado: string | null;
  ultimoMensaje: string | null;
}

export interface CredencialSriEnUso {
  usuarioSri: string;
  claveSri: string;
  ciAdicionalSri: string | null;
}

/**
 * Guarda, consulta y elimina las credenciales de SRI en Línea que un usuario
 * decide dejar en la app para que sus comprobantes recibidos se descarguen
 * solos. Es una función optativa y apagada por defecto: guardar la clave no
 * activa nada por sí sola, hay que además activar autoDescargaHabilitada.
 *
 * La clave se cifra con AES-256-GCM (utilidades/cifrado-credencial-sri.ts)
 * y este servicio es el único lugar del backend que la descifra, y solo
 * para pasarla en memoria al proceso que hace la descarga (nunca se
 * registra en logs ni se devuelve por ningún endpoint).
 */
@Injectable()
export class SriCredencialesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async guardar(usuarioId: number, dto: GuardarCredencialesSriDto) {
    const clave = obtenerClaveCifrado(
      this.configService.get<string>('FACTURACION_FIRMA_ENCRYPTION_KEY'),
    );
    const credencialCifrada = cifrarClaveSri(dto.claveSri, clave);

    await this.prismaService.credencialSri.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        usuarioSri: dto.usuarioSri.trim(),
        ciAdicionalSri: dto.ciAdicionalSri?.trim() || null,
        claveCifrada: credencialCifrada.contenido,
        vectorInicializacion: credencialCifrada.vectorInicializacion,
        etiquetaAutenticacion: credencialCifrada.etiquetaAutenticacion,
        autoDescargaHabilitada: dto.autoDescargaHabilitada ?? false,
      },
      update: {
        usuarioSri: dto.usuarioSri.trim(),
        ciAdicionalSri: dto.ciAdicionalSri?.trim() || null,
        claveCifrada: credencialCifrada.contenido,
        vectorInicializacion: credencialCifrada.vectorInicializacion,
        etiquetaAutenticacion: credencialCifrada.etiquetaAutenticacion,
        ...(dto.autoDescargaHabilitada !== undefined
          ? { autoDescargaHabilitada: dto.autoDescargaHabilitada }
          : {}),
        // Un cambio de credenciales invalida el resultado de la ejecución
        // anterior: mejor mostrar "sin ejecutar todavía" que un estado viejo.
        ultimaEjecucionEn: null,
        ultimoResultado: null,
        ultimoMensaje: null,
      },
    });

    return {
      mensaje: 'Credenciales del SRI guardadas y cifradas correctamente',
      estado: await this.obtenerEstado(usuarioId),
    };
  }

  async obtenerEstado(usuarioId: number): Promise<EstadoCredencialSri> {
    const credencial = await this.prismaService.credencialSri.findUnique({
      where: { usuarioId },
    });

    if (!credencial) {
      return {
        configurado: false,
        usuarioSri: null,
        ciAdicionalSri: null,
        autoDescargaHabilitada: false,
        ultimaEjecucionEn: null,
        ultimoResultado: null,
        ultimoMensaje: null,
      };
    }

    return {
      configurado: true,
      usuarioSri: credencial.usuarioSri,
      ciAdicionalSri: credencial.ciAdicionalSri,
      autoDescargaHabilitada: credencial.autoDescargaHabilitada,
      ultimaEjecucionEn: credencial.ultimaEjecucionEn,
      ultimoResultado: credencial.ultimoResultado,
      ultimoMensaje: credencial.ultimoMensaje,
    };
  }

  async actualizarAutoDescarga(
    usuarioId: number,
    dto: ActualizarAutoDescargaSriDto,
  ) {
    await this.obtenerCredencialORequerida(usuarioId);

    await this.prismaService.credencialSri.update({
      where: { usuarioId },
      data: { autoDescargaHabilitada: dto.autoDescargaHabilitada },
    });

    return {
      mensaje: dto.autoDescargaHabilitada
        ? 'Descarga automática activada'
        : 'Descarga automática desactivada',
      estado: await this.obtenerEstado(usuarioId),
    };
  }

  async eliminar(usuarioId: number) {
    await this.obtenerCredencialORequerida(usuarioId);

    await this.prismaService.credencialSri.delete({ where: { usuarioId } });

    return { mensaje: 'Credenciales del SRI eliminadas' };
  }

  /**
   * Solo para uso interno del runner de descarga (nunca se expone por HTTP).
   * Descifra la clave en memoria para pasarla al proceso que automatiza
   * SRI en Línea.
   */
  async obtenerCredencialDescifrada(
    usuarioId: number,
  ): Promise<CredencialSriEnUso | null> {
    const credencial = await this.prismaService.credencialSri.findUnique({
      where: { usuarioId },
    });

    if (!credencial) {
      return null;
    }

    const clave = obtenerClaveCifrado(
      this.configService.get<string>('FACTURACION_FIRMA_ENCRYPTION_KEY'),
    );

    const claveSri = descifrarClaveSri(
      credencial.claveCifrada,
      credencial.vectorInicializacion,
      credencial.etiquetaAutenticacion,
      clave,
    );

    return {
      usuarioSri: credencial.usuarioSri,
      claveSri,
      ciAdicionalSri: credencial.ciAdicionalSri,
    };
  }

  /** Usuarios que activaron la descarga automática (para el job programado). */
  async listarUsuariosConAutoDescargaHabilitada(): Promise<number[]> {
    const credenciales = await this.prismaService.credencialSri.findMany({
      where: { autoDescargaHabilitada: true },
      select: { usuarioId: true },
    });

    return credenciales.map((c) => c.usuarioId);
  }

  async registrarResultadoEjecucion(
    usuarioId: number,
    resultado: 'EXITO' | 'ERROR',
    mensaje: string,
  ) {
    await this.prismaService.credencialSri.update({
      where: { usuarioId },
      data: {
        ultimaEjecucionEn: new Date(),
        ultimoResultado: resultado,
        // Se recorta por si el mensaje de error viene muy largo.
        ultimoMensaje: mensaje.slice(0, 2000),
      },
    });
  }

  private async obtenerCredencialORequerida(usuarioId: number) {
    const credencial = await this.prismaService.credencialSri.findUnique({
      where: { usuarioId },
    });

    if (!credencial) {
      throw new NotFoundException(
        'No tienes credenciales del SRI guardadas todavía',
      );
    }

    return credencial;
  }
}
