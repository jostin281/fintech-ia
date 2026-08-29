import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import {
  CrearClienteDto,
  type TipoIdentificacionSriDto,
} from './dto/crear-cliente.dto';
import { ConsultaRucSriService } from './consulta-ruc-sri.service';
import {
  esCedulaEcuadorValida,
  esRucEcuadorValido,
} from './utilidades/identificacion-ecuador';

@Injectable()
export class ClientesFacturacionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly consultaRucSriService: ConsultaRucSriService,
  ) {}

  async crear(usuarioId: number, crearClienteDto: CrearClienteDto) {
    const perfil = await this.obtenerPerfil(usuarioId);
    this.validarIdentificacion(
      crearClienteDto.tipoIdentificacion,
      crearClienteDto.identificacion,
      crearClienteDto.razonSocial,
    );

    const clienteExistente =
      await this.prismaService.clienteFacturacion.findUnique({
        where: {
          perfilTributarioId_identificacion: {
            perfilTributarioId: perfil.id,
            identificacion: crearClienteDto.identificacion,
          },
        },
      });

    if (clienteExistente?.activo) {
      throw new ConflictException(
        'Ya existe un cliente con esa identificación',
      );
    }

    if (clienteExistente) {
      const cliente = await this.prismaService.clienteFacturacion.update({
        where: { id: clienteExistente.id },
        data: {
          tipoIdentificacion: crearClienteDto.tipoIdentificacion,
          razonSocial: crearClienteDto.razonSocial,
          nombreComercial: crearClienteDto.nombreComercial,
          correo: crearClienteDto.correo,
          direccion: crearClienteDto.direccion,
          telefono: crearClienteDto.telefono,
          activo: true,
        },
      });

      return {
        mensaje: 'Cliente creado correctamente',
        cliente,
      };
    }

    try {
      const cliente = await this.prismaService.clienteFacturacion.create({
        data: {
          ...crearClienteDto,
          perfilTributarioId: perfil.id,
        },
      });

      return {
        mensaje: 'Cliente creado correctamente',
        cliente,
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe un cliente con esa identificación',
        );
      }

      throw error;
    }
  }

  async listar(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const clientes = await this.prismaService.clienteFacturacion.findMany({
      where: { perfilTributarioId: perfil.id, activo: true },
      orderBy: [{ razonSocial: 'asc' }, { id: 'asc' }],
    });

    return {
      total: clientes.length,
      clientes,
    };
  }

  async obtenerUno(usuarioId: number, clienteId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const cliente = await this.prismaService.clienteFacturacion.findFirst({
      where: { id: clienteId, perfilTributarioId: perfil.id, activo: true },
    });

    if (!cliente) {
      throw new NotFoundException('El cliente solicitado no existe');
    }

    return { cliente };
  }

  async actualizar(
    usuarioId: number,
    clienteId: number,
    actualizarClienteDto: ActualizarClienteDto,
  ) {
    if (Object.keys(actualizarClienteDto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un dato para actualizar',
      );
    }

    const perfil = await this.obtenerPerfil(usuarioId);
    const cliente = await this.prismaService.clienteFacturacion.findFirst({
      where: { id: clienteId, perfilTributarioId: perfil.id, activo: true },
    });

    if (!cliente) {
      throw new NotFoundException('El cliente solicitado no existe');
    }

    const tipoIdentificacion =
      actualizarClienteDto.tipoIdentificacion ?? cliente.tipoIdentificacion;
    const identificacion =
      actualizarClienteDto.identificacion ?? cliente.identificacion;
    const razonSocial = actualizarClienteDto.razonSocial ?? cliente.razonSocial;

    this.validarIdentificacion(tipoIdentificacion, identificacion, razonSocial);

    try {
      const clienteActualizado =
        await this.prismaService.clienteFacturacion.update({
          where: { id: cliente.id },
          data: actualizarClienteDto,
        });

      return {
        mensaje: 'Cliente actualizado correctamente',
        cliente: clienteActualizado,
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException(
          'Ya existe un cliente con esa identificación',
        );
      }

      throw error;
    }
  }

  async eliminar(usuarioId: number, clienteId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const resultado = await this.prismaService.clienteFacturacion.updateMany({
      where: { id: clienteId, perfilTributarioId: perfil.id, activo: true },
      data: { activo: false },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('El cliente solicitado no existe');
    }

    return {
      mensaje: 'Cliente desactivado correctamente',
      cliente: { id: clienteId, activo: false },
    };
  }

  private validarIdentificacion(
    tipo: TipoIdentificacionSriDto,
    identificacion: string,
    razonSocial: string,
  ): void {
    if (tipo === 'RUC' && !esRucEcuadorValido(identificacion)) {
      throw new BadRequestException(
        'El RUC del cliente no tiene un formato o dígito verificador válido',
      );
    }

    if (tipo === 'CEDULA' && !esCedulaEcuadorValida(identificacion)) {
      throw new BadRequestException(
        'La cédula del cliente no tiene un formato o dígito verificador válido',
      );
    }

    if (
      (tipo === 'PASAPORTE' || tipo === 'IDENTIFICACION_EXTERIOR') &&
      !/^[A-Za-z0-9._-]{3,20}$/.test(identificacion)
    ) {
      throw new BadRequestException(
        'La identificación extranjera debe contener entre 3 y 20 caracteres alfanuméricos',
      );
    }

    if (
      tipo === 'CONSUMIDOR_FINAL' &&
      (identificacion !== '9999999999999' ||
        razonSocial.toUpperCase() !== 'CONSUMIDOR FINAL')
    ) {
      throw new BadRequestException(
        'Consumidor final debe usar identificación 9999999999999 y razón social CONSUMIDOR FINAL',
      );
    }
  }

  /**
   * Autocompleta la razón social de un cliente a partir de su RUC,
   * consultando el padrón público del SRI (mismo servicio que ya se usa
   * para validar el RUC del propio perfil tributario). Solo funciona con
   * RUC (13 dígitos): la cédula no tiene un padrón público equivalente en
   * Ecuador, así que para CEDULA el usuario debe escribir el nombre a mano.
   */
  async consultarRuc(ruc: string) {
    if (!esRucEcuadorValido(ruc)) {
      throw new BadRequestException(
        'El RUC no tiene un formato o dígito verificador válido',
      );
    }

    const resultado = await this.consultaRucSriService.consultar(ruc);

    if (resultado.tipo === 'NO_EXISTE') {
      throw new NotFoundException('El RUC no está registrado en el SRI');
    }

    if (resultado.tipo === 'SERVICIO_NO_DISPONIBLE') {
      return {
        disponible: false,
        motivo: resultado.motivo,
      };
    }

    return {
      disponible: true,
      razonSocial: resultado.info.razonSocial,
      estado: resultado.info.estado,
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

  private esViolacionDeRestriccionUnica(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
