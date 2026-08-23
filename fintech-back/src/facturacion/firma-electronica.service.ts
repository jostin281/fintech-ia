import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { certificateInfo, loadCertificate, type Certificate } from 'sri-ec';

import { PrismaService } from '../prisma/prisma.service';
import {
  cifrarCertificado,
  descifrarCertificado,
  obtenerClaveCifrado,
} from './utilidades/cifrado-credencial';

export interface ArchivoFirmaElectronica {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const TAMANO_MAXIMO_FIRMA = 5 * 1024 * 1024;

@Injectable()
export class FirmaElectronicaService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async guardar(
    usuarioId: number,
    archivo: ArchivoFirmaElectronica | undefined,
    claveP12: string,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Debe adjuntar el archivo de firma electrónica',
      );
    }

    this.validarArchivo(archivo);

    const perfil = await this.obtenerPerfil(usuarioId);

    let certificado: Certificate;

    try {
      certificado = loadCertificate(archivo.buffer, claveP12);
    } catch (error: unknown) {
      const detalle =
        error instanceof Error ? error.message : 'Archivo P12 inválido';
      throw new BadRequestException(detalle);
    }

    const informacion = certificateInfo(certificado);

    if (informacion.notAfter.getTime() <= Date.now()) {
      throw new BadRequestException(
        'El certificado de firma electrónica está caducado',
      );
    }

    const claveCifrado = obtenerClaveCifrado(
      this.configService.get<string>('FACTURACION_FIRMA_ENCRYPTION_KEY'),
    );
    const credencial = cifrarCertificado(certificado, claveCifrado);

    const firma = await this.prismaService.firmaElectronica.upsert({
      where: { perfilTributarioId: perfil.id },
      create: {
        credencialCifrada: credencial.contenido,
        vectorInicializacion: credencial.vectorInicializacion,
        etiquetaAutenticacion: credencial.etiquetaAutenticacion,
        nombreArchivo: archivo.originalname,
        numeroSerie: informacion.serialNumberDecimal,
        emisorCertificado: informacion.issuerRfc4514,
        tipoClave: informacion.keyType,
        validoHasta: informacion.notAfter,
        activo: true,
        perfilTributarioId: perfil.id,
      },
      update: {
        credencialCifrada: credencial.contenido,
        vectorInicializacion: credencial.vectorInicializacion,
        etiquetaAutenticacion: credencial.etiquetaAutenticacion,
        nombreArchivo: archivo.originalname,
        numeroSerie: informacion.serialNumberDecimal,
        emisorCertificado: informacion.issuerRfc4514,
        tipoClave: informacion.keyType,
        validoHasta: informacion.notAfter,
        activo: true,
      },
    });

    return {
      mensaje: 'Firma electrónica guardada y cifrada correctamente',
      firmaElectronica: this.presentar(firma),
    };
  }

  async obtenerEstado(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const firma = await this.prismaService.firmaElectronica.findUnique({
      where: { perfilTributarioId: perfil.id },
    });

    if (!firma || !firma.activo) {
      throw new NotFoundException('No existe una firma electrónica activa');
    }

    return {
      firmaElectronica: this.presentar(firma),
    };
  }

  async desactivar(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const resultado = await this.prismaService.firmaElectronica.updateMany({
      where: { perfilTributarioId: perfil.id, activo: true },
      data: { activo: false },
    });

    if (resultado.count === 0) {
      throw new NotFoundException('No existe una firma electrónica activa');
    }

    return {
      mensaje: 'Firma electrónica desactivada correctamente',
    };
  }

  async obtenerCertificadoParaFirmar(
    perfilTributarioId: number,
  ): Promise<Certificate> {
    const firma = await this.prismaService.firmaElectronica.findFirst({
      where: {
        perfilTributarioId,
        activo: true,
        validoHasta: { gt: new Date() },
      },
    });

    if (!firma) {
      throw new BadRequestException(
        'Debe registrar una firma electrónica vigente antes de emitir',
      );
    }

    const claveCifrado = obtenerClaveCifrado(
      this.configService.get<string>('FACTURACION_FIRMA_ENCRYPTION_KEY'),
    );

    return descifrarCertificado(
      firma.credencialCifrada,
      firma.vectorInicializacion,
      firma.etiquetaAutenticacion,
      claveCifrado,
    );
  }

  private validarArchivo(archivo: ArchivoFirmaElectronica): void {
    const nombre = archivo.originalname.toLowerCase();

    if (!nombre.endsWith('.p12') && !nombre.endsWith('.pfx')) {
      throw new BadRequestException('La firma debe ser un archivo .p12 o .pfx');
    }

    if (archivo.size <= 0 || archivo.buffer.length === 0) {
      throw new BadRequestException('El archivo de firma está vacío');
    }

    if (archivo.size > TAMANO_MAXIMO_FIRMA) {
      throw new BadRequestException(
        'El archivo de firma no puede superar 5 MB',
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

  private presentar(firma: {
    id: number;
    nombreArchivo: string;
    numeroSerie: string;
    emisorCertificado: string;
    tipoClave: string;
    validoHasta: Date;
    activo: boolean;
    creadoEn: Date;
    actualizadoEn: Date;
  }) {
    const diasParaCaducar = Math.ceil(
      (firma.validoHasta.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    return {
      id: firma.id,
      nombreArchivo: firma.nombreArchivo,
      numeroSerie: firma.numeroSerie,
      emisorCertificado: firma.emisorCertificado,
      tipoClave: firma.tipoClave,
      validoHasta: firma.validoHasta,
      diasParaCaducar,
      proximaACaducar: diasParaCaducar <= 30,
      activo: firma.activo,
      creadoEn: firma.creadoEn,
      actualizadoEn: firma.actualizadoEn,
    };
  }
}
