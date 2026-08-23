import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import {
  Ambiente,
  FetchSoapTransport,
  SriClient,
  TipoComprobante,
  TipoEmision,
  type Factura,
  type Message,
} from 'sri-ec';
import { generarRide } from 'sri-ec/ride';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarFacturaDto } from './dto/actualizar-factura.dto';
import {
  CrearFacturaDto,
  type CrearDetalleFacturaDto,
} from './dto/crear-factura.dto';
import { FiltrarFacturasDto } from './dto/filtrar-facturas.dto';
import { FirmaElectronicaService } from './firma-electronica.service';
import {
  calcularTotalesFactura,
  type EntradaDetalleCalculo,
} from './utilidades/calculadora-factura';
import {
  convertirFechaIsoEcuador,
  formatearFechaSri,
  obtenerFechaActualEcuador,
} from './utilidades/fecha-ecuador';

const CODIGO_DOCUMENTO_FACTURA = '01';
const MONTO_MAXIMO_CONSUMIDOR_FINAL = new Decimal(50);

interface FacturaParaSri {
  id: number;
  fechaEmision: Date;
  formaPago: string;
  observacion: string | null;
  establecimiento: string;
  puntoEmision: string;
  secuencial: number | null;
  emisorRuc: string;
  emisorRazonSocial: string;
  emisorNombreComercial: string | null;
  emisorDireccionMatriz: string;
  emisorRegimenTributario: string;
  emisorObligadoContabilidad: boolean;
  emisorCodigoContribuyenteEspecial: string | null;
  emisorCodigoAgenteRetencion: string | null;
  emisorAmbienteSri: string;
  compradorTipoIdentificacion: string;
  compradorIdentificacion: string;
  compradorRazonSocial: string;
  compradorCorreo: string | null;
  compradorDireccion: string | null;
  totalSinImpuestos: { toFixed(decimales: number): string };
  totalDescuento: { toFixed(decimales: number): string };
  subtotalCero: { toFixed(decimales: number): string };
  subtotalQuince: { toFixed(decimales: number): string };
  iva: { toFixed(decimales: number): string };
  importeTotal: { toFixed(decimales: number): string };
  detalles: Array<{
    codigoPrincipal: string;
    descripcion: string;
    cantidad: { toFixed(decimales: number): string };
    precioUnitario: { toFixed(decimales: number): string };
    descuento: { toFixed(decimales: number): string };
    tarifaIva: string;
    baseImponible: { toFixed(decimales: number): string };
    valorIva: { toFixed(decimales: number): string };
  }>;
}

@Injectable()
export class FacturasService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly firmaElectronicaService: FirmaElectronicaService,
    private readonly configService: ConfigService,
  ) {}

  async crear(usuarioId: number, crearFacturaDto: CrearFacturaDto) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const cliente = await this.obtenerCliente(
      perfil.id,
      crearFacturaDto.clienteId,
    );
    const entradas = await this.prepararDetalles(
      perfil.id,
      crearFacturaDto.detalles,
    );
    const totales = calcularTotalesFactura(entradas);
    this.validarConsumidorFinal(
      cliente.tipoIdentificacion,
      totales.importeTotal,
    );

    const fechaEmision = this.obtenerFechaEmision(crearFacturaDto.fechaEmision);

    const factura = await this.prismaService.facturaElectronica.create({
      data: {
        estado: 'BORRADOR',
        establecimiento: perfil.establecimiento,
        puntoEmision: perfil.puntoEmision,
        fechaEmision,
        formaPago: crearFacturaDto.formaPago ?? '20',
        observacion: crearFacturaDto.observacion,
        emisorRuc: perfil.ruc,
        emisorRazonSocial: perfil.razonSocial,
        emisorNombreComercial: perfil.nombreComercial,
        emisorDireccionMatriz: perfil.direccionMatriz,
        emisorRegimenTributario: perfil.regimenTributario,
        emisorObligadoContabilidad: perfil.obligadoContabilidad,
        emisorCodigoContribuyenteEspecial: perfil.codigoContribuyenteEspecial,
        emisorCodigoAgenteRetencion: perfil.codigoAgenteRetencion,
        emisorAmbienteSri: perfil.ambienteSri,
        compradorTipoIdentificacion: cliente.tipoIdentificacion,
        compradorIdentificacion: cliente.identificacion,
        compradorRazonSocial: cliente.razonSocial,
        compradorCorreo: cliente.correo,
        compradorDireccion: cliente.direccion,
        subtotalCero: totales.subtotalCero,
        subtotalQuince: totales.subtotalQuince,
        totalSinImpuestos: totales.totalSinImpuestos,
        totalDescuento: totales.totalDescuento,
        iva: totales.iva,
        importeTotal: totales.importeTotal,
        perfilTributarioId: perfil.id,
        clienteId: cliente.id,
        detalles: {
          create: totales.detalles,
        },
      },
      include: { detalles: true },
    });

    return {
      mensaje: 'Borrador de factura creado correctamente',
      factura: this.presentar(factura),
    };
  }

  async listar(usuarioId: number, filtros: FiltrarFacturasDto) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const rango = this.obtenerRangoFiltros(filtros);

    const facturas = await this.prismaService.facturaElectronica.findMany({
      where: {
        perfilTributarioId: perfil.id,
        eliminadoEn: null,
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(rango !== undefined
          ? {
              fechaEmision: {
                gte: rango.fechaDesde,
                lt: rango.fechaHastaExclusiva,
              },
            }
          : {}),
      },
      include: { detalles: true },
      orderBy: [{ fechaEmision: 'desc' }, { id: 'desc' }],
    });

    return {
      total: facturas.length,
      facturas: facturas.map((factura) => this.presentar(factura)),
    };
  }

  async obtenerUno(usuarioId: number, facturaId: number) {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    return {
      factura: this.presentar(factura),
    };
  }

  async actualizar(
    usuarioId: number,
    facturaId: number,
    actualizarFacturaDto: ActualizarFacturaDto,
  ) {
    if (Object.keys(actualizarFacturaDto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un dato para actualizar',
      );
    }

    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    if (factura.estado !== 'BORRADOR') {
      throw new ConflictException(
        'Solo se puede editar una factura en borrador',
      );
    }

    const cliente =
      actualizarFacturaDto.clienteId !== undefined
        ? await this.obtenerCliente(
            factura.perfilTributarioId,
            actualizarFacturaDto.clienteId,
          )
        : factura.cliente;

    const totales =
      actualizarFacturaDto.detalles !== undefined
        ? calcularTotalesFactura(
            await this.prepararDetalles(
              factura.perfilTributarioId,
              actualizarFacturaDto.detalles,
            ),
          )
        : undefined;

    this.validarConsumidorFinal(
      cliente.tipoIdentificacion,
      totales?.importeTotal ?? factura.importeTotal.toFixed(2),
    );

    const facturaActualizada =
      await this.prismaService.facturaElectronica.update({
        where: { id: factura.id },
        data: {
          ...(actualizarFacturaDto.clienteId !== undefined
            ? {
                clienteId: cliente.id,
                compradorTipoIdentificacion: cliente.tipoIdentificacion,
                compradorIdentificacion: cliente.identificacion,
                compradorRazonSocial: cliente.razonSocial,
                compradorCorreo: cliente.correo,
                compradorDireccion: cliente.direccion,
              }
            : {}),
          ...(actualizarFacturaDto.fechaEmision !== undefined
            ? {
                fechaEmision: this.obtenerFechaEmision(
                  actualizarFacturaDto.fechaEmision,
                ),
              }
            : {}),
          ...(actualizarFacturaDto.formaPago !== undefined
            ? { formaPago: actualizarFacturaDto.formaPago }
            : {}),
          ...(actualizarFacturaDto.observacion !== undefined
            ? { observacion: actualizarFacturaDto.observacion }
            : {}),
          ...(totales !== undefined
            ? {
                subtotalCero: totales.subtotalCero,
                subtotalQuince: totales.subtotalQuince,
                totalSinImpuestos: totales.totalSinImpuestos,
                totalDescuento: totales.totalDescuento,
                iva: totales.iva,
                importeTotal: totales.importeTotal,
                detalles: {
                  deleteMany: {},
                  create: totales.detalles,
                },
              }
            : {}),
        },
        include: { detalles: true },
      });

    return {
      mensaje: 'Borrador de factura actualizado correctamente',
      factura: this.presentar(facturaActualizada),
    };
  }

  async anularBorrador(usuarioId: number, facturaId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const resultado = await this.prismaService.facturaElectronica.updateMany({
      where: {
        id: facturaId,
        perfilTributarioId: perfil.id,
        estado: 'BORRADOR',
        eliminadoEn: null,
      },
      data: {
        estado: 'ANULADA_LOCAL',
        eliminadoEn: new Date(),
      },
    });

    if (resultado.count === 0) {
      throw new NotFoundException(
        'La factura no existe o ya inició su proceso de emisión',
      );
    }

    return {
      mensaje: 'Borrador anulado localmente',
      factura: { id: facturaId, estado: 'ANULADA_LOCAL' },
    };
  }

  async emitir(usuarioId: number, facturaId: number) {
    const facturaInicial = await this.obtenerFacturaCompleta(
      usuarioId,
      facturaId,
    );

    if (facturaInicial.estado !== 'BORRADOR') {
      throw new ConflictException(
        'La factura ya inició su proceso de emisión; consulte o reintente su estado',
      );
    }

    this.validarAmbienteProduccion(facturaInicial.emisorAmbienteSri);
    const certificado =
      await this.firmaElectronicaService.obtenerCertificadoParaFirmar(
        facturaInicial.perfilTributarioId,
      );

    /*
     * El bloqueo transaccional evita que dos solicitudes simultáneas asignen
     * claves distintas al mismo borrador. La transacción termina antes de
     * llamar a la red del SRI; solo protege secuencial, firma y persistencia.
     */
    await this.prismaService.$transaction(async (transaccion) => {
      await transaccion.$queryRaw`
        SELECT pg_advisory_xact_lock(${facturaId})
      `;

      let factura = await transaccion.facturaElectronica.findFirst({
        where: {
          id: facturaId,
          eliminadoEn: null,
          perfilTributario: { usuarioId, activo: true },
        },
        include: {
          detalles: true,
          cliente: true,
          perfilTributario: true,
        },
      });

      if (!factura || factura.estado !== 'BORRADOR') {
        throw new ConflictException(
          'La factura ya inició su proceso de emisión',
        );
      }

      if (factura.secuencial === null) {
        const secuencia = await transaccion.secuenciaComprobante.upsert({
          where: {
            perfilTributarioId_codigoDocumento_establecimiento_puntoEmision: {
              perfilTributarioId: factura.perfilTributarioId,
              codigoDocumento: CODIGO_DOCUMENTO_FACTURA,
              establecimiento: factura.establecimiento,
              puntoEmision: factura.puntoEmision,
            },
          },
          create: {
            perfilTributarioId: factura.perfilTributarioId,
            codigoDocumento: CODIGO_DOCUMENTO_FACTURA,
            establecimiento: factura.establecimiento,
            puntoEmision: factura.puntoEmision,
            siguienteSecuencial: 2,
          },
          update: {
            siguienteSecuencial: { increment: 1 },
          },
          select: { siguienteSecuencial: true },
        });

        factura = await transaccion.facturaElectronica.update({
          where: { id: factura.id },
          data: { secuencial: secuencia.siguienteSecuencial - 1 },
          include: {
            detalles: true,
            cliente: true,
            perfilTributario: true,
          },
        });
      }

      const documento = this.construirDocumentoSri(factura);
      const ambiente = this.mapearAmbiente(factura.emisorAmbienteSri);
      const clienteSri = new SriClient({ ambiente, certificate: certificado });

      let preparado: ReturnType<SriClient['prepare']>;

      try {
        preparado = clienteSri.prepare(documento);
      } catch (error: unknown) {
        const mensaje =
          error instanceof Error ? error.message : 'No se pudo firmar el XML';
        throw new BadRequestException(mensaje);
      }

      await transaccion.facturaElectronica.update({
        where: { id: factura.id },
        data: {
          estado: 'FIRMADA',
          claveAcceso: preparado.claveAcceso,
          xmlFirmado: preparado.signedXml,
          ultimoIntentoSri: new Date(),
        },
      });
    });

    return this.enviarXmlFirmado(usuarioId, facturaId);
  }

  async reenviarSri(usuarioId: number, facturaId: number) {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    if (factura.estado !== 'FIRMADA' || !factura.xmlFirmado) {
      throw new ConflictException(
        'Solo se puede reenviar una factura firmada cuyo resultado de recepción es incierto',
      );
    }

    this.validarAmbienteProduccion(factura.emisorAmbienteSri);
    return this.enviarXmlFirmado(usuarioId, factura.id);
  }

  async consultarSri(usuarioId: number, facturaId: number) {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    if (!factura.claveAcceso) {
      throw new ConflictException(
        'La factura todavía no tiene una clave de acceso',
      );
    }

    if (factura.estado === 'AUTORIZADA') {
      return {
        mensaje: 'La factura ya se encuentra autorizada',
        factura: this.presentar(factura),
      };
    }

    this.validarAmbienteProduccion(factura.emisorAmbienteSri);
    const transporte = new FetchSoapTransport();

    try {
      const autorizacion = await transporte.autorizar(
        factura.claveAcceso,
        this.mapearAmbiente(factura.emisorAmbienteSri),
        { signal: this.crearSignalSri() },
      );

      return this.guardarAutorizacion(factura.id, autorizacion);
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible consultar el SRI. La factura conserva su estado anterior',
      );
    }
  }

  async obtenerXml(usuarioId: number, facturaId: number): Promise<Buffer> {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);
    const xml = factura.xmlAutorizado ?? factura.xmlFirmado;

    if (!xml) {
      throw new NotFoundException(
        'La factura todavía no tiene un XML generado',
      );
    }

    return Buffer.from(xml, 'utf8');
  }

  async generarRide(usuarioId: number, facturaId: number): Promise<Buffer> {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    if (!factura.claveAcceso) {
      throw new ConflictException(
        'La factura todavía no tiene una clave de acceso',
      );
    }

    const documento = this.construirDocumentoSri(factura);
    const pdf = await generarRide({
      documento,
      claveAcceso: factura.claveAcceso,
      ...(factura.estado === 'AUTORIZADA' &&
      factura.numeroAutorizacion !== null &&
      factura.fechaAutorizacion !== null
        ? {
            autorizacion: {
              numero: factura.numeroAutorizacion,
              fecha: factura.fechaAutorizacion.toISOString(),
            },
          }
        : {}),
      opciones: {
        codigoBarras: true,
        incluirQr: false,
      },
    });

    return Buffer.from(pdf);
  }

  private async enviarXmlFirmado(usuarioId: number, facturaId: number) {
    const factura = await this.obtenerFacturaCompleta(usuarioId, facturaId);

    if (!factura.xmlFirmado || !factura.claveAcceso) {
      throw new ConflictException(
        'La factura no tiene un XML firmado persistido',
      );
    }

    const transporte = new FetchSoapTransport();
    const ambiente = this.mapearAmbiente(factura.emisorAmbienteSri);

    try {
      const recepcion = await transporte.enviar(factura.xmlFirmado, ambiente, {
        signal: this.crearSignalSri(),
      });
      const mensajesRecepcion = this.serializarMensajes(recepcion.mensajes);

      if (recepcion.estado.trim().toUpperCase() !== 'RECIBIDA') {
        const facturaDevuelta =
          await this.prismaService.facturaElectronica.update({
            where: { id: factura.id },
            data: {
              estado: 'DEVUELTA',
              mensajesSri: mensajesRecepcion,
              ultimoIntentoSri: new Date(),
            },
            include: { detalles: true },
          });

        return {
          mensaje: 'El SRI devolvió la factura durante la recepción',
          factura: this.presentar(facturaDevuelta),
          mensajesSri: mensajesRecepcion,
        };
      }

      await this.prismaService.facturaElectronica.update({
        where: { id: factura.id },
        data: {
          estado: 'RECIBIDA',
          mensajesSri: mensajesRecepcion,
          ultimoIntentoSri: new Date(),
        },
      });

      const autorizacion = await transporte.autorizar(
        factura.claveAcceso,
        ambiente,
        { signal: this.crearSignalSri() },
      );

      return this.guardarAutorizacion(factura.id, autorizacion);
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo completar la comunicación con el SRI. Use consultar-sri o reenviar-sri; no cree otra factura',
      );
    }
  }

  private async guardarAutorizacion(
    facturaId: number,
    autorizacion: {
      estado: string;
      numeroAutorizacion?: string;
      fechaAutorizacion?: string;
      comprobante?: string;
      mensajes: Message[];
    },
  ) {
    const estadoNormalizado = autorizacion.estado.trim().toUpperCase();
    const mensajes = this.serializarMensajes(autorizacion.mensajes);

    if (estadoNormalizado === 'AUTORIZADO') {
      if (
        !autorizacion.numeroAutorizacion ||
        !autorizacion.fechaAutorizacion ||
        !autorizacion.comprobante
      ) {
        throw new ServiceUnavailableException(
          'El SRI respondió AUTORIZADO sin todos los datos de autorización; consulte nuevamente',
        );
      }

      const facturaAutorizada =
        await this.prismaService.facturaElectronica.update({
          where: { id: facturaId },
          data: {
            estado: 'AUTORIZADA',
            numeroAutorizacion: autorizacion.numeroAutorizacion,
            fechaAutorizacion: this.convertirFechaAutorizacion(
              autorizacion.fechaAutorizacion,
            ),
            xmlAutorizado: autorizacion.comprobante,
            mensajesSri: mensajes,
            ultimoIntentoSri: new Date(),
          },
          include: { detalles: true },
        });

      return {
        mensaje: 'Factura autorizada correctamente por el SRI',
        factura: this.presentar(facturaAutorizada),
        mensajesSri: mensajes,
      };
    }

    if (
      estadoNormalizado === 'EN PROCESO' ||
      estadoNormalizado === 'EN PROCESAMIENTO'
    ) {
      const facturaEnProceso =
        await this.prismaService.facturaElectronica.update({
          where: { id: facturaId },
          data: {
            estado: 'RECIBIDA',
            mensajesSri: mensajes,
            ultimoIntentoSri: new Date(),
          },
          include: { detalles: true },
        });

      return {
        mensaje: 'El SRI recibió la factura y todavía la está procesando',
        factura: this.presentar(facturaEnProceso),
        mensajesSri: mensajes,
      };
    }

    const facturaNoAutorizada =
      await this.prismaService.facturaElectronica.update({
        where: { id: facturaId },
        data: {
          estado: 'NO_AUTORIZADA',
          mensajesSri: mensajes,
          ultimoIntentoSri: new Date(),
        },
        include: { detalles: true },
      });

    return {
      mensaje: 'El SRI no autorizó la factura',
      factura: this.presentar(facturaNoAutorizada),
      mensajesSri: mensajes,
    };
  }

  private construirDocumentoSri(factura: FacturaParaSri): Factura {
    if (factura.secuencial === null) {
      throw new ConflictException('La factura no tiene un secuencial asignado');
    }

    const totalConImpuestos: Factura['totalConImpuestos'] = [];

    if (new Decimal(factura.subtotalCero.toFixed(2)).greaterThan(0)) {
      totalConImpuestos.push({
        codigo: '2',
        codigoPorcentaje: '0',
        baseImponible: factura.subtotalCero.toFixed(2),
        valor: '0.00',
      });
    }

    if (new Decimal(factura.subtotalQuince.toFixed(2)).greaterThan(0)) {
      totalConImpuestos.push({
        codigo: '2',
        codigoPorcentaje: '4',
        baseImponible: factura.subtotalQuince.toFixed(2),
        valor: factura.iva.toFixed(2),
      });
    }

    const infoAdicional: Record<string, string> = {};

    if (factura.compradorCorreo) {
      infoAdicional['Email'] = factura.compradorCorreo;
    }

    if (factura.observacion) {
      infoAdicional['Observacion'] = factura.observacion;
    }

    const leyendaRimpe = this.obtenerLeyendaRimpe(
      factura.emisorRegimenTributario,
    );

    return {
      tipo: TipoComprobante.Factura,
      infoTributaria: {
        ambiente: this.mapearAmbiente(factura.emisorAmbienteSri),
        tipoEmision: TipoEmision.Normal,
        razonSocial: factura.emisorRazonSocial,
        ...(factura.emisorNombreComercial
          ? { nombreComercial: factura.emisorNombreComercial }
          : {}),
        ruc: factura.emisorRuc,
        estab: factura.establecimiento,
        ptoEmi: factura.puntoEmision,
        secuencial: String(factura.secuencial).padStart(9, '0'),
        dirMatriz: factura.emisorDireccionMatriz,
        ...(leyendaRimpe ? { contribuyenteRimpe: leyendaRimpe } : {}),
        ...(factura.emisorCodigoAgenteRetencion
          ? {
              agenteRetencion: factura.emisorCodigoAgenteRetencion,
            }
          : {}),
      },
      fechaEmision: formatearFechaSri(factura.fechaEmision),
      dirEstablecimiento: factura.emisorDireccionMatriz,
      ...(factura.emisorCodigoContribuyenteEspecial
        ? {
            contribuyenteEspecial: factura.emisorCodigoContribuyenteEspecial,
          }
        : {}),
      obligadoContabilidad: factura.emisorObligadoContabilidad ? 'SI' : 'NO',
      tipoIdentificacionComprador: this.mapearTipoIdentificacion(
        factura.compradorTipoIdentificacion,
      ),
      razonSocialComprador: factura.compradorRazonSocial,
      identificacionComprador: factura.compradorIdentificacion,
      ...(factura.compradorDireccion
        ? { direccionComprador: factura.compradorDireccion }
        : {}),
      totalSinImpuestos: factura.totalSinImpuestos.toFixed(2),
      totalDescuento: factura.totalDescuento.toFixed(2),
      totalConImpuestos,
      propina: '0.00',
      importeTotal: factura.importeTotal.toFixed(2),
      moneda: 'DOLAR',
      pagos: [
        {
          formaPago: factura.formaPago,
          total: factura.importeTotal.toFixed(2),
        },
      ],
      detalles: factura.detalles.map((detalle) => ({
        codigoPrincipal: detalle.codigoPrincipal,
        descripcion: detalle.descripcion,
        cantidad: detalle.cantidad.toFixed(6),
        precioUnitario: detalle.precioUnitario.toFixed(6),
        descuento: detalle.descuento.toFixed(2),
        precioTotalSinImpuesto: detalle.baseImponible.toFixed(2),
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: detalle.tarifaIva === 'QUINCE' ? '4' : '0',
            tarifa: detalle.tarifaIva === 'QUINCE' ? '15.00' : '0.00',
            baseImponible: detalle.baseImponible.toFixed(2),
            valor: detalle.valorIva.toFixed(2),
          },
        ],
      })),
      ...(Object.keys(infoAdicional).length > 0 ? { infoAdicional } : {}),
    };
  }

  private async prepararDetalles(
    perfilTributarioId: number,
    detalles: CrearDetalleFacturaDto[],
  ): Promise<EntradaDetalleCalculo[]> {
    const ids = detalles.map((detalle) => detalle.productoServicioId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'No repita un producto en la factura; utilice una sola línea con la cantidad total',
      );
    }

    const productos =
      await this.prismaService.productoServicioFacturacion.findMany({
        where: {
          id: { in: ids },
          perfilTributarioId,
          activo: true,
        },
      });

    if (productos.length !== ids.length) {
      throw new NotFoundException(
        'Uno o más productos no existen, están desactivados o pertenecen a otro usuario',
      );
    }

    const productosPorId = new Map(
      productos.map((producto) => [producto.id, producto] as const),
    );

    return detalles.map((detalle) => {
      const producto = productosPorId.get(detalle.productoServicioId);

      if (!producto) {
        throw new NotFoundException('No se encontró un producto de la factura');
      }

      return {
        productoServicioId: producto.id,
        codigoPrincipal: producto.codigoPrincipal,
        descripcion: producto.descripcion,
        precioUnitario: producto.precioUnitario.toString(),
        tarifaIva: producto.tarifaIva,
        cantidad: detalle.cantidad,
        descuento: detalle.descuento,
      };
    });
  }

  private async obtenerPerfil(usuarioId: number) {
    const perfil = await this.prismaService.perfilTributario.findFirst({
      where: { usuarioId, activo: true },
    });

    if (!perfil) {
      throw new NotFoundException('Primero debe crear el perfil tributario');
    }

    return perfil;
  }

  private async obtenerCliente(perfilTributarioId: number, clienteId: number) {
    const cliente = await this.prismaService.clienteFacturacion.findFirst({
      where: { id: clienteId, perfilTributarioId, activo: true },
    });

    if (!cliente) {
      throw new NotFoundException('El cliente seleccionado no existe');
    }

    return cliente;
  }

  private async obtenerFacturaCompleta(usuarioId: number, facturaId: number) {
    const factura = await this.prismaService.facturaElectronica.findFirst({
      where: {
        id: facturaId,
        eliminadoEn: null,
        perfilTributario: { usuarioId, activo: true },
      },
      include: {
        detalles: true,
        cliente: true,
        perfilTributario: true,
      },
    });

    if (!factura) {
      throw new NotFoundException(
        'La factura no existe o pertenece a otro usuario',
      );
    }

    return factura;
  }

  private obtenerFechaEmision(fechaIso: string | undefined): Date {
    const fechaActual = obtenerFechaActualEcuador();
    const fechaSolicitada = fechaIso ?? fechaActual.iso;

    if (fechaSolicitada > fechaActual.iso) {
      throw new BadRequestException('La fecha de emisión no puede ser futura');
    }

    return convertirFechaIsoEcuador(fechaSolicitada);
  }

  private validarConsumidorFinal(tipo: string, importeTotal: string): void {
    if (
      tipo === 'CONSUMIDOR_FINAL' &&
      new Decimal(importeTotal).greaterThan(MONTO_MAXIMO_CONSUMIDOR_FINAL)
    ) {
      throw new BadRequestException(
        'Las facturas a consumidor final no pueden superar USD 50; registre la identificación del comprador',
      );
    }
  }

  private mapearAmbiente(ambienteSri: string): Ambiente {
    return ambienteSri === 'PRODUCCION'
      ? Ambiente.Produccion
      : Ambiente.Pruebas;
  }

  private obtenerLeyendaRimpe(regimenTributario: string): string | null {
    if (regimenTributario === 'RIMPE_NEGOCIO_POPULAR') {
      return 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE';
    }

    if (regimenTributario === 'RIMPE_EMPRENDEDOR') {
      return 'CONTRIBUYENTE RÉGIMEN RIMPE';
    }

    return null;
  }

  private mapearTipoIdentificacion(tipo: string): string {
    const codigos: Record<string, string> = {
      RUC: '04',
      CEDULA: '05',
      PASAPORTE: '06',
      CONSUMIDOR_FINAL: '07',
      IDENTIFICACION_EXTERIOR: '08',
    };

    const codigo = codigos[tipo];

    if (!codigo) {
      throw new BadRequestException('El tipo de identificación no es válido');
    }

    return codigo;
  }

  private validarAmbienteProduccion(ambienteSri: string): void {
    if (
      ambienteSri === 'PRODUCCION' &&
      this.configService.get<string>('SRI_PRODUCCION_HABILITADA') !== 'true'
    ) {
      throw new ConflictException(
        'La emisión en producción está bloqueada. Complete la certificación y habilite SRI_PRODUCCION_HABILITADA=true',
      );
    }
  }

  private crearSignalSri(): AbortSignal {
    const configurado = Number(
      this.configService.get<string>('SRI_TIMEOUT_MS') ?? '30000',
    );
    const milisegundos =
      Number.isInteger(configurado) &&
      configurado >= 1000 &&
      configurado <= 120000
        ? configurado
        : 30000;

    return AbortSignal.timeout(milisegundos);
  }

  private serializarMensajes(mensajes: Message[]) {
    return mensajes.map((mensaje) => ({
      identificador: mensaje.identificador,
      mensaje: mensaje.mensaje,
      ...(mensaje.tipo !== undefined ? { tipo: mensaje.tipo } : {}),
      ...(mensaje.informacionAdicional !== undefined
        ? { informacionAdicional: mensaje.informacionAdicional }
        : {}),
    }));
  }

  private convertirFechaAutorizacion(fecha: string): Date {
    const resultado = new Date(fecha);

    if (Number.isNaN(resultado.getTime())) {
      throw new ServiceUnavailableException(
        'El SRI devolvió una fecha de autorización inválida; consulte nuevamente',
      );
    }

    return resultado;
  }

  private obtenerRangoFiltros(
    filtros: FiltrarFacturasDto,
  ): { fechaDesde: Date; fechaHastaExclusiva: Date } | undefined {
    if (filtros.mes !== undefined && filtros.anio === undefined) {
      throw new BadRequestException('Debe enviar el año cuando filtra por mes');
    }

    if (filtros.anio === undefined) {
      return undefined;
    }

    const mesInicial = filtros.mes !== undefined ? filtros.mes - 1 : 0;
    const mesFinal = filtros.mes !== undefined ? filtros.mes : 12;

    return {
      fechaDesde: new Date(Date.UTC(filtros.anio, mesInicial, 1, 5)),
      fechaHastaExclusiva: new Date(Date.UTC(filtros.anio, mesFinal, 1, 5)),
    };
  }

  private presentar(factura: {
    id: number;
    estado: string;
    establecimiento: string;
    puntoEmision: string;
    secuencial: number | null;
    claveAcceso: string | null;
    fechaEmision: Date;
    formaPago: string;
    observacion: string | null;
    emisorRuc: string;
    emisorRazonSocial: string;
    emisorNombreComercial: string | null;
    emisorDireccionMatriz: string;
    emisorRegimenTributario: string;
    emisorObligadoContabilidad: boolean;
    emisorAmbienteSri: string;
    compradorTipoIdentificacion: string;
    compradorIdentificacion: string;
    compradorRazonSocial: string;
    compradorCorreo: string | null;
    compradorDireccion: string | null;
    subtotalCero: { toFixed(decimales: number): string };
    subtotalQuince: { toFixed(decimales: number): string };
    totalSinImpuestos: { toFixed(decimales: number): string };
    totalDescuento: { toFixed(decimales: number): string };
    iva: { toFixed(decimales: number): string };
    importeTotal: { toFixed(decimales: number): string };
    numeroAutorizacion: string | null;
    fechaAutorizacion: Date | null;
    mensajesSri: unknown;
    creadoEn: Date;
    actualizadoEn: Date;
    detalles: Array<{
      id: number;
      productoServicioId: number;
      codigoPrincipal: string;
      descripcion: string;
      cantidad: { toFixed(decimales: number): string };
      precioUnitario: { toFixed(decimales: number): string };
      descuento: { toFixed(decimales: number): string };
      tarifaIva: string;
      baseImponible: { toFixed(decimales: number): string };
      valorIva: { toFixed(decimales: number): string };
      total: { toFixed(decimales: number): string };
    }>;
  }) {
    const numero =
      factura.secuencial === null
        ? null
        : `${factura.establecimiento}-${factura.puntoEmision}-${String(
            factura.secuencial,
          ).padStart(9, '0')}`;

    return {
      id: factura.id,
      estado: factura.estado,
      numero,
      claveAcceso: factura.claveAcceso,
      fechaEmision: factura.fechaEmision,
      formaPago: factura.formaPago,
      observacion: factura.observacion,
      emisor: {
        ruc: factura.emisorRuc,
        razonSocial: factura.emisorRazonSocial,
        nombreComercial: factura.emisorNombreComercial,
        direccionMatriz: factura.emisorDireccionMatriz,
        regimenTributario: factura.emisorRegimenTributario,
        obligadoContabilidad: factura.emisorObligadoContabilidad,
        ambienteSri: factura.emisorAmbienteSri,
      },
      comprador: {
        tipoIdentificacion: factura.compradorTipoIdentificacion,
        identificacion: factura.compradorIdentificacion,
        razonSocial: factura.compradorRazonSocial,
        correo: factura.compradorCorreo,
        direccion: factura.compradorDireccion,
      },
      totales: {
        subtotalCero: factura.subtotalCero.toFixed(2),
        subtotalQuince: factura.subtotalQuince.toFixed(2),
        totalSinImpuestos: factura.totalSinImpuestos.toFixed(2),
        totalDescuento: factura.totalDescuento.toFixed(2),
        iva: factura.iva.toFixed(2),
        importeTotal: factura.importeTotal.toFixed(2),
      },
      numeroAutorizacion: factura.numeroAutorizacion,
      fechaAutorizacion: factura.fechaAutorizacion,
      mensajesSri: factura.mensajesSri,
      detalles: factura.detalles.map((detalle) => ({
        id: detalle.id,
        productoServicioId: detalle.productoServicioId,
        codigoPrincipal: detalle.codigoPrincipal,
        descripcion: detalle.descripcion,
        cantidad: detalle.cantidad.toFixed(6),
        precioUnitario: detalle.precioUnitario.toFixed(6),
        descuento: detalle.descuento.toFixed(2),
        tarifaIva: detalle.tarifaIva,
        baseImponible: detalle.baseImponible.toFixed(2),
        valorIva: detalle.valorIva.toFixed(2),
        total: detalle.total.toFixed(2),
      })),
      creadoEn: factura.creadoEn,
      actualizadoEn: factura.actualizadoEn,
    };
  }
}
