import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPerfilTributarioDto } from './dto/actualizar-perfil-tributario.dto';
import {
  CrearPerfilTributarioDto,
  TipoIdentificacionPerfilDto,
} from './dto/crear-perfil-tributario.dto';
import { ConsultaRucSriService } from './consulta-ruc-sri.service';
import {
  esCedulaEcuadorValida,
  esRucEcuadorValido,
} from './utilidades/identificacion-ecuador';

@Injectable()
export class PerfilTributarioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly consultaRucSriService: ConsultaRucSriService,
  ) {}

  async crear(
    usuarioId: number,
    crearPerfilTributarioDto: CrearPerfilTributarioDto,
  ) {
    this.validarCompatibilidadRegimen(
      crearPerfilTributarioDto.tipoContribuyente,
      crearPerfilTributarioDto.regimenTributario,
    );
    this.validarCompatibilidadIdentificacion(
      crearPerfilTributarioDto.tipoIdentificacion,
      crearPerfilTributarioDto.tipoContribuyente,
    );

    const ruc = this.normalizarRuc(
      crearPerfilTributarioDto.tipoIdentificacion,
      crearPerfilTributarioDto.ruc,
    );

    const ambienteSri = crearPerfilTributarioDto.ambienteSri ?? 'PRUEBAS';
    const advertenciaSri = await this.validarRucContraSri(ruc, ambienteSri);

    const perfilDelUsuario =
      await this.prismaService.perfilTributario.findUnique({
        where: { usuarioId },
        select: { id: true },
      });

    if (perfilDelUsuario) {
      throw new ConflictException(
        'El usuario ya tiene un perfil tributario registrado',
      );
    }

    const perfilConMismoRuc =
      await this.prismaService.perfilTributario.findUnique({
        where: { ruc },
        select: { id: true },
      });

    if (perfilConMismoRuc) {
      throw new ConflictException('El RUC ya está registrado');
    }

    try {
      const perfil = await this.prismaService.perfilTributario.create({
        data: {
          ruc,
          razonSocial: crearPerfilTributarioDto.razonSocial,
          nombreComercial: crearPerfilTributarioDto.nombreComercial,
          direccionMatriz: crearPerfilTributarioDto.direccionMatriz,
          tipoContribuyente: crearPerfilTributarioDto.tipoContribuyente,
          regimenTributario: crearPerfilTributarioDto.regimenTributario,
          obligadoContabilidad:
            crearPerfilTributarioDto.obligadoContabilidad ?? false,
          codigoContribuyenteEspecial:
            crearPerfilTributarioDto.codigoContribuyenteEspecial,
          codigoAgenteRetencion: crearPerfilTributarioDto.codigoAgenteRetencion,
          establecimiento: crearPerfilTributarioDto.establecimiento ?? '001',
          puntoEmision: crearPerfilTributarioDto.puntoEmision ?? '001',
          ambienteSri,
          usuarioId,
        },
      });

      return {
        mensaje: 'Perfil tributario creado correctamente',
        perfilTributario: this.presentar(perfil),
        ...(advertenciaSri ? { advertenciaSri } : {}),
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException('El usuario o el RUC ya tiene un perfil');
      }

      throw error;
    }
  }

  async obtenerDelUsuario(usuarioId: number) {
    const perfil = await this.prismaService.perfilTributario.findFirst({
      where: { usuarioId, activo: true },
    });

    if (!perfil) {
      throw new NotFoundException(
        'El usuario no tiene un perfil tributario activo',
      );
    }

    return {
      perfilTributario: this.presentar(perfil),
    };
  }

  async actualizar(
    usuarioId: number,
    actualizarPerfilTributarioDto: ActualizarPerfilTributarioDto,
  ) {
    if (Object.keys(actualizarPerfilTributarioDto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un dato para actualizar',
      );
    }

    const perfilExistente = await this.prismaService.perfilTributario.findFirst(
      {
        where: { usuarioId, activo: true },
      },
    );

    if (!perfilExistente) {
      throw new NotFoundException(
        'El usuario no tiene un perfil tributario activo',
      );
    }

    const tipoContribuyente =
      actualizarPerfilTributarioDto.tipoContribuyente ??
      perfilExistente.tipoContribuyente;
    const regimenTributario =
      actualizarPerfilTributarioDto.regimenTributario ??
      perfilExistente.regimenTributario;

    this.validarCompatibilidadRegimen(tipoContribuyente, regimenTributario);

    let ruc: string | undefined;
    let advertenciaSri: string | undefined;
    if (actualizarPerfilTributarioDto.ruc !== undefined) {
      this.validarCompatibilidadIdentificacion(
        actualizarPerfilTributarioDto.tipoIdentificacion,
        tipoContribuyente,
      );
      ruc = this.normalizarRuc(
        actualizarPerfilTributarioDto.tipoIdentificacion,
        actualizarPerfilTributarioDto.ruc,
      );
      advertenciaSri = await this.validarRucContraSri(
        ruc,
        perfilExistente.ambienteSri as 'PRUEBAS' | 'PRODUCCION',
      );
    }

    const cambiaIdentidadDeEmision =
      (ruc !== undefined && ruc !== perfilExistente.ruc) ||
      (actualizarPerfilTributarioDto.establecimiento !== undefined &&
        actualizarPerfilTributarioDto.establecimiento !==
          perfilExistente.establecimiento) ||
      (actualizarPerfilTributarioDto.puntoEmision !== undefined &&
        actualizarPerfilTributarioDto.puntoEmision !==
          perfilExistente.puntoEmision);

    if (cambiaIdentidadDeEmision) {
      const facturasQueFijanIdentidad =
        await this.prismaService.facturaElectronica.count({
          where: {
            perfilTributarioId: perfilExistente.id,
            eliminadoEn: null,
          },
        });

      if (facturasQueFijanIdentidad > 0) {
        throw new ConflictException(
          'No se puede cambiar el RUC, establecimiento o punto de emisión mientras existan borradores activos o facturas emitidas',
        );
      }
    }

    if (ruc !== undefined && ruc !== perfilExistente.ruc) {
      const perfilConMismoRuc =
        await this.prismaService.perfilTributario.findUnique({
          where: { ruc },
          select: { id: true },
        });

      if (perfilConMismoRuc) {
        throw new ConflictException('El RUC ya está registrado');
      }
    }

    try {
      const perfil = await this.prismaService.perfilTributario.update({
        where: { id: perfilExistente.id },
        data: {
          ...(ruc !== undefined ? { ruc } : {}),
          ...(actualizarPerfilTributarioDto.razonSocial !== undefined
            ? { razonSocial: actualizarPerfilTributarioDto.razonSocial }
            : {}),
          ...(actualizarPerfilTributarioDto.nombreComercial !== undefined
            ? { nombreComercial: actualizarPerfilTributarioDto.nombreComercial }
            : {}),
          ...(actualizarPerfilTributarioDto.direccionMatriz !== undefined
            ? { direccionMatriz: actualizarPerfilTributarioDto.direccionMatriz }
            : {}),
          ...(actualizarPerfilTributarioDto.tipoContribuyente !== undefined
            ? {
                tipoContribuyente:
                  actualizarPerfilTributarioDto.tipoContribuyente,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.regimenTributario !== undefined
            ? {
                regimenTributario:
                  actualizarPerfilTributarioDto.regimenTributario,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.obligadoContabilidad !== undefined
            ? {
                obligadoContabilidad:
                  actualizarPerfilTributarioDto.obligadoContabilidad,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.codigoContribuyenteEspecial !==
          undefined
            ? {
                codigoContribuyenteEspecial:
                  actualizarPerfilTributarioDto.codigoContribuyenteEspecial,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.codigoAgenteRetencion !== undefined
            ? {
                codigoAgenteRetencion:
                  actualizarPerfilTributarioDto.codigoAgenteRetencion,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.establecimiento !== undefined
            ? {
                establecimiento: actualizarPerfilTributarioDto.establecimiento,
              }
            : {}),
          ...(actualizarPerfilTributarioDto.puntoEmision !== undefined
            ? { puntoEmision: actualizarPerfilTributarioDto.puntoEmision }
            : {}),
        },
      });

      return {
        mensaje: 'Perfil tributario actualizado correctamente',
        perfilTributario: this.presentar(perfil),
        ...(advertenciaSri ? { advertenciaSri } : {}),
      };
    } catch (error: unknown) {
      if (this.esViolacionDeRestriccionUnica(error)) {
        throw new ConflictException('El RUC ya está registrado');
      }

      throw error;
    }
  }

  private validarCompatibilidadRegimen(
    tipoContribuyente: 'PERSONA_NATURAL' | 'SOCIEDAD',
    regimenTributario:
      | 'GENERAL'
      | 'RIMPE_NEGOCIO_POPULAR'
      | 'RIMPE_EMPRENDEDOR',
  ): void {
    if (
      tipoContribuyente === 'SOCIEDAD' &&
      regimenTributario === 'RIMPE_NEGOCIO_POPULAR'
    ) {
      throw new BadRequestException(
        'Una sociedad no puede configurarse como RIMPE Negocio Popular',
      );
    }
  }

  /**
   * Convierte lo que envió el usuario en el RUC de trece dígitos que exige
   * la base de datos. Si eligió "CEDULA", valida la cédula (módulo 10) y le
   * agrega el establecimiento "001": así es como el SRI define el RUC de
   * una persona natural a partir de su cédula. Si no se envía
   * tipoIdentificacion, se mantiene el comportamiento anterior (se asume
   * que "ruc" ya es un RUC completo).
   */
  private normalizarRuc(
    tipoIdentificacion: TipoIdentificacionPerfilDto | undefined,
    ruc: string,
  ): string {
    if (tipoIdentificacion === 'CEDULA') {
      if (!esCedulaEcuadorValida(ruc)) {
        throw new BadRequestException(
          'La cédula no tiene un formato o dígito verificador válido',
        );
      }

      return `${ruc}001`;
    }

    this.validarRuc(ruc);
    return ruc;
  }

  private validarCompatibilidadIdentificacion(
    tipoIdentificacion: TipoIdentificacionPerfilDto | undefined,
    tipoContribuyente: 'PERSONA_NATURAL' | 'SOCIEDAD',
  ): void {
    if (
      tipoIdentificacion === 'CEDULA' &&
      tipoContribuyente !== 'PERSONA_NATURAL'
    ) {
      throw new BadRequestException(
        'La cédula solo es válida para contribuyentes de tipo persona natural',
      );
    }
  }

  private validarRuc(ruc: string): void {
    if (!esRucEcuadorValido(ruc)) {
      throw new BadRequestException(
        'El RUC no tiene un formato o dígito verificador válido',
      );
    }
  }

  /**
   * Confirma el RUC contra el padrón público del SRI antes de guardar el
   * perfil. Si el SRI confirma que el RUC no existe, o que existe pero
   * está inactivo/suspendido, se rechaza la operación: es un dato
   * confiable y bloquear tiene sentido. Pero si el servicio del SRI no
   * responde (está caído, cambió de URL, problema de red, etc.) NO se
   * bloquea al usuario: el perfil se guarda igual y se devuelve una
   * advertencia, porque este es un endpoint interno del SRI, no una API
   * oficial garantizada.
   */
  private async validarRucContraSri(
    ruc: string,
    ambienteSri: 'PRUEBAS' | 'PRODUCCION',
  ): Promise<string | undefined> {
    // En PRUEBAS se usan RUC ficticios de sandbox (los que el propio SRI
    // documenta para certificación) que nunca van a existir en el padrón
    // público real, así que validar ahí solo rechazaría perfiles válidos
    // de desarrollo. Solo se exige en PRODUCCION.
    if (ambienteSri !== 'PRODUCCION') {
      return undefined;
    }

    const resultado = await this.consultaRucSriService.consultar(ruc);

    if (resultado.tipo === 'NO_EXISTE') {
      throw new BadRequestException('El RUC no está registrado en el SRI');
    }

    if (resultado.tipo === 'SERVICIO_NO_DISPONIBLE') {
      return `No se pudo validar el RUC contra el SRI en este momento (${resultado.motivo}). El perfil se guardó igual, pero verifica manualmente que el RUC esté correcto.`;
    }

    const estado = resultado.info.estado?.toUpperCase() ?? null;

    if (estado && estado !== 'ACTIVO') {
      throw new BadRequestException(
        `El RUC existe en el SRI pero su estado es "${resultado.info.estado}", no ACTIVO`,
      );
    }

    return undefined;
  }

  private presentar(perfil: {
    id: number;
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    direccionMatriz: string;
    tipoContribuyente: string;
    regimenTributario: string;
    obligadoContabilidad: boolean;
    codigoContribuyenteEspecial: string | null;
    codigoAgenteRetencion: string | null;
    establecimiento: string;
    puntoEmision: string;
    ambienteSri: string;
    activo: boolean;
    creadoEn: Date;
    actualizadoEn: Date;
  }) {
    return {
      id: perfil.id,
      ruc: perfil.ruc,
      razonSocial: perfil.razonSocial,
      nombreComercial: perfil.nombreComercial,
      direccionMatriz: perfil.direccionMatriz,
      tipoContribuyente: perfil.tipoContribuyente,
      regimenTributario: perfil.regimenTributario,
      obligadoContabilidad: perfil.obligadoContabilidad,
      codigoContribuyenteEspecial: perfil.codigoContribuyenteEspecial,
      codigoAgenteRetencion: perfil.codigoAgenteRetencion,
      establecimiento: perfil.establecimiento,
      puntoEmision: perfil.puntoEmision,
      ambienteSri: perfil.ambienteSri,
      activo: perfil.activo,
      creadoEn: perfil.creadoEn,
      actualizadoEn: perfil.actualizadoEn,
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
