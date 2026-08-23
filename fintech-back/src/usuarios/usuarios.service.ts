import { ConflictException, Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface DatosNuevoUsuario {
  nombre: string;
  correo: string;
  contrasenaHash: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prismaService: PrismaService) {}

  // Busca un usuario mediante su correo.
  async buscarPorCorreo(correo: string) {
    return this.prismaService.usuario.findUnique({
      where: {
        correo,
      },
    });
  }

  // Devuelve la clave personal de Gemini del usuario autenticado, si tiene una.
  async obtenerClaveGemini(usuarioId: number) {
    const usuario = await this.prismaService.usuario.findUnique({
      where: { id: usuarioId },
      select: { geminiApiKey: true },
    });

    return {
      geminiApiKey: usuario?.geminiApiKey ?? null,
    };
  }

  // Guarda, actualiza o borra (con null/cadena vacía) la clave personal de Gemini.
  async actualizarClaveGemini(usuarioId: number, geminiApiKey: string | null | undefined) {
    const valorNormalizado = geminiApiKey?.trim() || null;

    const usuario = await this.prismaService.usuario.update({
      where: { id: usuarioId },
      data: { geminiApiKey: valorNormalizado },
      select: { geminiApiKey: true },
    });

    return {
      mensaje: valorNormalizado
        ? 'Clave de Gemini guardada correctamente'
        : 'Clave de Gemini eliminada; se usará el motor de reglas local',
      geminiApiKey: usuario.geminiApiKey,
    };
  }

  // Guarda un usuario nuevo sin devolver su contraseña hash.
  async crear(datos: DatosNuevoUsuario) {
    try {
      return await this.prismaService.usuario.create({
        data: {
          nombre: datos.nombre,
          correo: datos.correo,
          contrasenaHash: datos.contrasenaHash,
        },
        select: {
          id: true,
          nombre: true,
          correo: true,
          rol: true,
          activo: true,
          creadoEn: true,
          actualizadoEn: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un usuario registrado con ese correo',
        );
      }

      throw error;
    }
  }
}
