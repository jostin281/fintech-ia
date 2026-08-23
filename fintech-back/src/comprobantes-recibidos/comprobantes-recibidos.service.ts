import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarCategoriaDetalleDto } from './dto/actualizar-categoria-detalle.dto';
import { FiltrarComprobantesRecibidosDto } from './dto/filtrar-comprobantes-recibidos.dto';
import type { ArchivoComprobanteSubido } from './interfaces/archivo-subido.interface';
import type { FacturaSriRecibida } from './interfaces/factura-sri-recibida.interface';
import {
  clasificarDescripcion,
  ordenarReglasPorPrioridad,
  type ReglaCategorizacionCandidata,
} from './utilidades/categorizador-comprobantes';
import { parsearFacturaSriRecibida } from './utilidades/parser-factura-sri-recibida';

export type EstadoResultadoImportacion =
  'PROCESADO' | 'DUPLICADO' | 'NO_RECONOCIDO' | 'ERROR_XML';

export interface ResultadoImportacionComprobante {
  archivo: string;
  estado: EstadoResultadoImportacion;
  comprobanteId?: number;
  detalle?: string;
}

export interface ResumenImportacion {
  mensaje: string;
  procesados: number;
  duplicados: number;
  noReconocidos: number;
  errores: number;
  resultados: ResultadoImportacionComprobante[];
}

@Injectable()
export class ComprobantesRecibidosService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Importa un lote de XML de facturas recibidas. Cada archivo se procesa
   * de forma independiente (si uno falla, los demás igual se procesan) y de
   * forma síncrona dentro de este mismo request: no hay cola en esta fase.
   */
  async importar(
    usuarioId: number,
    archivos: ArchivoComprobanteSubido[],
  ): Promise<ResumenImportacion> {
    if (archivos.length === 0) {
      throw new BadRequestException('Debe adjuntar al menos un archivo XML');
    }

    const reglas = await this.cargarReglasActivas(usuarioId);

    const resultados: ResultadoImportacionComprobante[] = [];
    let procesados = 0;
    let duplicados = 0;
    let noReconocidos = 0;
    let errores = 0;

    for (const archivo of archivos) {
      const resultado = await this.procesarUnArchivo(
        usuarioId,
        archivo,
        reglas,
      );

      resultados.push(resultado);

      switch (resultado.estado) {
        case 'PROCESADO':
          procesados += 1;
          break;
        case 'DUPLICADO':
          duplicados += 1;
          break;
        case 'NO_RECONOCIDO':
          noReconocidos += 1;
          break;
        case 'ERROR_XML':
          errores += 1;
          break;
      }
    }

    return {
      mensaje: `Importación completada: ${procesados} procesada(s), ${duplicados} duplicada(s), ${noReconocidos} no reconocida(s), ${errores} con error.`,
      procesados,
      duplicados,
      noReconocidos,
      errores,
      resultados,
    };
  }

  async listarDelUsuario(
    usuarioId: number,
    filtros: FiltrarComprobantesRecibidosDto,
  ) {
    const fechaDesde = filtros.fechaDesde
      ? this.convertirFechaInicial(filtros.fechaDesde)
      : undefined;
    const fechaHasta = filtros.fechaHasta
      ? this.convertirFechaFinal(filtros.fechaHasta)
      : undefined;

    if (
      fechaDesde !== undefined &&
      fechaHasta !== undefined &&
      fechaDesde.getTime() > fechaHasta.getTime()
    ) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la fecha final',
      );
    }

    const comprobantes = await this.prismaService.comprobanteRecibido.findMany({
      where: {
        usuarioId,
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
        ...(filtros.proveedorId !== undefined
          ? { proveedorId: filtros.proveedorId }
          : {}),
        ...(filtros.categoriaId !== undefined
          ? { detalles: { some: { categoriaId: filtros.categoriaId } } }
          : {}),
        ...(fechaDesde !== undefined || fechaHasta !== undefined
          ? {
              fechaEmision: {
                ...(fechaDesde !== undefined ? { gte: fechaDesde } : {}),
                ...(fechaHasta !== undefined ? { lte: fechaHasta } : {}),
              },
            }
          : {}),
        ...(filtros.q
          ? {
              OR: [
                {
                  razonSocialEmisor: {
                    contains: filtros.q,
                    mode: 'insensitive',
                  },
                },
                { secuencial: { contains: filtros.q } },
              ],
            }
          : {}),
      },
      orderBy: [{ fechaEmision: 'desc' }, { id: 'desc' }],
      include: {
        proveedor: { select: { id: true, razonSocial: true, ruc: true } },
        detalles: {
          select: {
            categoriaId: true,
            categoria: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    return {
      total: comprobantes.length,
      comprobantes: comprobantes.map((comprobante) =>
        this.presentarResumen(comprobante),
      ),
    };
  }

  async obtenerUno(usuarioId: number, comprobanteId: number) {
    const comprobante = await this.buscarPropio(usuarioId, comprobanteId, {
      proveedor: true,
      detalles: {
        orderBy: { id: 'asc' },
        include: { categoria: { select: { id: true, nombre: true } } },
      },
    });

    return { comprobante: this.presentarCompleto(comprobante) };
  }

  async obtenerXmlOriginal(
    usuarioId: number,
    comprobanteId: number,
  ): Promise<{ xml: Buffer; nombreArchivo: string }> {
    const comprobante = await this.buscarPropio(usuarioId, comprobanteId);

    return {
      xml: Buffer.from(comprobante.xmlOriginal, 'utf8'),
      nombreArchivo: `comprobante-${comprobanteId}.xml`,
    };
  }

  async obtenerDesglose(usuarioId: number, comprobanteId: number) {
    const comprobante = await this.buscarPropio(usuarioId, comprobanteId, {
      proveedor: true,
      detalles: {
        orderBy: { id: 'asc' },
        include: { categoria: { select: { id: true, nombre: true } } },
      },
    });

    const basesIvaPorTarifa = new Map<
      string,
      {
        tarifaCodigo: string;
        tarifaPorcentaje: string;
        base: Decimal;
        iva: Decimal;
      }
    >();
    const distribucionPorCategoria = new Map<
      string,
      { categoriaId: number | null; categoria: string; total: Decimal }
    >();

    for (const detalle of comprobante.detalles) {
      const claveTarifa = detalle.tarifaCodigo;
      const acumuladoTarifa = basesIvaPorTarifa.get(claveTarifa) ?? {
        tarifaCodigo: detalle.tarifaCodigo,
        tarifaPorcentaje: detalle.tarifaPorcentaje.toFixed(2),
        base: new Decimal(0),
        iva: new Decimal(0),
      };
      acumuladoTarifa.base = acumuladoTarifa.base.plus(
        detalle.baseImponible.toString(),
      );
      acumuladoTarifa.iva = acumuladoTarifa.iva.plus(
        detalle.valorIva.toString(),
      );
      basesIvaPorTarifa.set(claveTarifa, acumuladoTarifa);

      const claveCategoria = detalle.categoriaId
        ? String(detalle.categoriaId)
        : 'SIN_CATEGORIZAR';
      const acumuladoCategoria = distribucionPorCategoria.get(
        claveCategoria,
      ) ?? {
        categoriaId: detalle.categoriaId,
        categoria: detalle.categoria?.nombre ?? 'Sin categorizar',
        total: new Decimal(0),
      };
      acumuladoCategoria.total = acumuladoCategoria.total.plus(
        detalle.total.toString(),
      );
      distribucionPorCategoria.set(claveCategoria, acumuladoCategoria);
    }

    const totalGeneral = comprobante.detalles.reduce(
      (acumulado, detalle) => acumulado.plus(detalle.total.toString()),
      new Decimal(0),
    );

    return {
      comprobante: this.presentarCompleto(comprobante),
      basesIva: Array.from(basesIvaPorTarifa.values()).map((item) => ({
        tarifaCodigo: item.tarifaCodigo,
        tarifaPorcentaje: item.tarifaPorcentaje,
        base: item.base.toFixed(2),
        iva: item.iva.toFixed(2),
      })),
      distribucionCategorias: Array.from(distribucionPorCategoria.values()).map(
        (item) => ({
          categoriaId: item.categoriaId,
          categoria: item.categoria,
          total: item.total.toFixed(2),
          porcentaje: totalGeneral.isZero()
            ? '0.00'
            : item.total.dividedBy(totalGeneral).times(100).toFixed(2),
        }),
      ),
    };
  }

  async actualizarCategoriaDetalle(
    usuarioId: number,
    comprobanteId: number,
    detalleId: number,
    dto: ActualizarCategoriaDetalleDto,
  ) {
    if (dto.crearRegla && !dto.palabraClave) {
      throw new BadRequestException(
        'Debe indicar una palabra clave para crear la regla',
      );
    }

    // Confirma que el comprobante sea del usuario autenticado antes de
    // tocar ninguna de sus líneas (nunca se confía en el detalleId solo).
    await this.buscarPropio(usuarioId, comprobanteId);

    const detalle =
      await this.prismaService.detalleComprobanteRecibido.findFirst({
        where: { id: detalleId, comprobanteRecibidoId: comprobanteId },
      });

    if (!detalle) {
      throw new NotFoundException(
        'La línea del comprobante no existe o no pertenece a este comprobante',
      );
    }

    await this.validarCategoriaGasto(dto.categoriaId);

    // Se resuelve antes de abrir la transacción de la línea/movimiento:
    // crear o reutilizar una regla es una operación independiente y así se
    // evita depender del tipo genérico del cliente transaccional de Prisma.
    const reglaCategorizacionId =
      dto.crearRegla && dto.palabraClave
        ? await this.crearOReutilizarReglaPersonal(
            usuarioId,
            dto.palabraClave,
            dto.categoriaId,
          )
        : null;

    const resultado = await this.prismaService.$transaction(
      async (transaccion) => {
        const detalleActualizado =
          await transaccion.detalleComprobanteRecibido.update({
            where: { id: detalleId },
            data: {
              categoriaId: dto.categoriaId,
              metodoClasificacion: 'MANUAL',
              reglaCategorizacionId,
              confianza: null,
            },
          });

        if (detalle.movimientoId) {
          await transaccion.movimiento.update({
            where: { id: detalle.movimientoId },
            data: { categoriaId: dto.categoriaId },
          });
        } else {
          const comprobante =
            await transaccion.comprobanteRecibido.findUniqueOrThrow({
              where: { id: comprobanteId },
            });

          const movimiento = await transaccion.movimiento.create({
            data: {
              tipo: 'GASTO',
              monto: detalle.total,
              descripcion: `${comprobante.razonSocialEmisor} · ${detalle.descripcion}`,
              fecha: comprobante.fechaEmision,
              usuarioId,
              categoriaId: dto.categoriaId,
              origen: 'SRI',
            },
          });

          await transaccion.detalleComprobanteRecibido.update({
            where: { id: detalleId },
            data: { movimientoId: movimiento.id },
          });
        }

        return detalleActualizado;
      },
    );

    return {
      mensaje: 'Categoría actualizada correctamente',
      detalle: { ...resultado, cantidad: resultado.cantidad.toString() },
    };
  }

  // ------------------------------------------------------------------
  // Métodos privados
  // ------------------------------------------------------------------

  private async procesarUnArchivo(
    usuarioId: number,
    archivo: ArchivoComprobanteSubido,
    reglas: ReglaCategorizacionCandidata[],
  ): Promise<ResultadoImportacionComprobante> {
    const texto = archivo.buffer.toString('utf-8');
    const resultado = parsearFacturaSriRecibida(texto);

    if (!resultado.ok) {
      return {
        archivo: archivo.originalname,
        estado: 'NO_RECONOCIDO',
        detalle: resultado.motivo,
      };
    }

    const factura = resultado.factura;

    const existente = await this.prismaService.comprobanteRecibido.findUnique({
      where: {
        usuarioId_claveAcceso: { usuarioId, claveAcceso: factura.claveAcceso },
      },
      select: { id: true },
    });

    if (existente) {
      return {
        archivo: archivo.originalname,
        estado: 'DUPLICADO',
        comprobanteId: existente.id,
        detalle: `Ya habías importado esta factura de ${factura.razonSocialEmisor}`,
      };
    }

    const proveedor = await this.prismaService.proveedor.upsert({
      where: { usuarioId_ruc: { usuarioId, ruc: factura.rucEmisor } },
      update: {
        razonSocial: factura.razonSocialEmisor,
        nombreComercial: factura.nombreComercialEmisor,
      },
      create: {
        usuarioId,
        ruc: factura.rucEmisor,
        razonSocial: factura.razonSocialEmisor,
        nombreComercial: factura.nombreComercialEmisor,
      },
    });

    if (factura.detalles.length === 0) {
      const comprobante = await this.prismaService.comprobanteRecibido.create({
        data: this.datosEncabezado(
          usuarioId,
          proveedor.id,
          factura,
          texto,
          archivo.originalname,
          { estado: 'ERROR_XML', mensajeError: factura.advertencia },
        ),
      });

      return {
        archivo: archivo.originalname,
        estado: 'ERROR_XML',
        comprobanteId: comprobante.id,
        detalle: factura.advertencia ?? 'No se pudieron leer los detalles',
      };
    }

    const reglasOrdenadas = ordenarReglasPorPrioridad(reglas, usuarioId);

    const comprobante = await this.prismaService.$transaction(
      async (transaccion) => {
        const creado = await transaccion.comprobanteRecibido.create({
          data: this.datosEncabezado(
            usuarioId,
            proveedor.id,
            factura,
            texto,
            archivo.originalname,
            { estado: 'PROCESADO', mensajeError: null },
          ),
        });

        for (const detalle of factura.detalles) {
          const impuestoIva = detalle.impuestos[0];
          const clasificacion = clasificarDescripcion(
            detalle.descripcion,
            reglasOrdenadas,
          );

          const detalleCreado =
            await transaccion.detalleComprobanteRecibido.create({
              data: {
                comprobanteRecibidoId: creado.id,
                codigoPrincipal: detalle.codigoPrincipal,
                descripcion: detalle.descripcion,
                cantidad: detalle.cantidad,
                precioUnitario: detalle.precioUnitario,
                descuento: detalle.descuento,
                baseImponible: detalle.precioTotalSinImpuesto,
                tarifaCodigo: impuestoIva?.codigoPorcentaje ?? '0',
                tarifaPorcentaje: impuestoIva?.tarifa ?? '0.00',
                valorIva: impuestoIva?.valor ?? '0.00',
                total: new Decimal(detalle.precioTotalSinImpuesto)
                  .plus(impuestoIva?.valor ?? '0.00')
                  .toFixed(2),
                categoriaId: clasificacion?.categoriaId ?? null,
                metodoClasificacion: clasificacion ? 'REGLA' : null,
                reglaCategorizacionId: clasificacion?.reglaId ?? null,
                confianza: clasificacion ? '100.00' : null,
              },
            });

          if (clasificacion) {
            const movimiento = await transaccion.movimiento.create({
              data: {
                tipo: 'GASTO',
                monto: detalleCreado.total,
                descripcion: `${factura.razonSocialEmisor} · ${detalle.descripcion}`,
                fecha: factura.fechaEmision,
                usuarioId,
                categoriaId: clasificacion.categoriaId,
                origen: 'SRI',
              },
            });

            await transaccion.detalleComprobanteRecibido.update({
              where: { id: detalleCreado.id },
              data: { movimientoId: movimiento.id },
            });
          }
        }

        return creado;
      },
    );

    return {
      archivo: archivo.originalname,
      estado: 'PROCESADO',
      comprobanteId: comprobante.id,
    };
  }

  private datosEncabezado(
    usuarioId: number,
    proveedorId: number,
    factura: FacturaSriRecibida,
    xmlOriginal: string,
    nombreArchivoOriginal: string,
    extra: { estado: 'PROCESADO' | 'ERROR_XML'; mensajeError: string | null },
  ) {
    return {
      usuarioId,
      proveedorId,
      estado: extra.estado,
      mensajeError: extra.mensajeError,
      claveAcceso: factura.claveAcceso,
      rucEmisor: factura.rucEmisor,
      razonSocialEmisor: factura.razonSocialEmisor,
      nombreComercialEmisor: factura.nombreComercialEmisor,
      establecimiento: factura.establecimiento,
      puntoEmision: factura.puntoEmision,
      secuencial: factura.secuencial,
      fechaEmision: factura.fechaEmision,
      subtotalSinImpuestos: factura.subtotalSinImpuestos,
      totalDescuento: factura.totalDescuento,
      iva: factura.iva,
      importeTotal: factura.importeTotal,
      // El XML original se conserva tal cual se subió (nunca el
      // desenvuelto de un CDATA ni ningún otro valor derivado).
      xmlOriginal,
      archivoNombre: nombreArchivoOriginal,
      procesadoEn: new Date(),
    };
  }

  private async cargarReglasActivas(
    usuarioId: number,
  ): Promise<ReglaCategorizacionCandidata[]> {
    const reglas = await this.prismaService.reglaCategorizacion.findMany({
      where: {
        activa: true,
        OR: [{ usuarioId: null }, { usuarioId }],
      },
      select: {
        id: true,
        usuarioId: true,
        palabraClave: true,
        prioridad: true,
        categoriaId: true,
      },
    });

    return reglas;
  }

  private async crearOReutilizarReglaPersonal(
    usuarioId: number,
    palabraClave: string,
    categoriaId: number,
  ): Promise<number> {
    const existente = await this.prismaService.reglaCategorizacion.findFirst({
      where: {
        usuarioId,
        palabraClave: { equals: palabraClave, mode: 'insensitive' },
      },
    });

    if (existente) {
      const actualizada = await this.prismaService.reglaCategorizacion.update({
        where: { id: existente.id },
        data: { categoriaId, activa: true },
      });
      return actualizada.id;
    }

    const creada = await this.prismaService.reglaCategorizacion.create({
      data: {
        usuarioId,
        palabraClave,
        categoriaId,
        origen: 'CORRECCION',
        prioridad: 10,
      },
    });

    return creada.id;
  }

  private async validarCategoriaGasto(categoriaId: number): Promise<void> {
    const categoria = await this.prismaService.categoria.findUnique({
      where: { id: categoriaId },
      select: { tipo: true, activa: true },
    });

    if (!categoria) {
      throw new NotFoundException('La categoría seleccionada no existe');
    }

    if (!categoria.activa) {
      throw new BadRequestException(
        'La categoría seleccionada está desactivada',
      );
    }

    if (categoria.tipo !== 'GASTO') {
      throw new BadRequestException(
        'Solo se pueden asignar categorías de tipo GASTO a un comprobante recibido',
      );
    }
  }

  private async buscarPropio(
    usuarioId: number,
    comprobanteId: number,
    include?: Record<string, unknown>,
  ) {
    const comprobante = await this.prismaService.comprobanteRecibido.findFirst({
      where: { id: comprobanteId, usuarioId },
      ...(include ? { include } : {}),
    });

    if (!comprobante) {
      throw new NotFoundException(
        'El comprobante no existe o no pertenece al usuario autenticado',
      );
    }

    // El parámetro "include" se recibe deliberadamente como
    // Record<string, unknown> (no como el tipo Include real de Prisma) para
    // que un solo método sirva a los distintos "include" que usa cada
    // llamador; eso le impide a Prisma inferir por generics el payload
    // ensanchado, así que se ensancha aquí a propósito. Cada método privado
    // que recibe este valor (presentarCompleto, etc.) ya declara
    // explícitamente los campos que necesita, así que la verificación de
    // tipos real ocurre ahí, no en este método genérico de "buscar y
    // validar propiedad".
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- necesario con el cliente real de Prisma, aunque parezca innecesario contra el stub de este entorno de verificación.
    return comprobante as any;
  }

  private presentarResumen(comprobante: {
    id: number;
    estado: string;
    rucEmisor: string;
    razonSocialEmisor: string;
    establecimiento: string;
    puntoEmision: string;
    secuencial: string;
    fechaEmision: Date;
    subtotalSinImpuestos: Decimal;
    iva: Decimal;
    importeTotal: Decimal;
    proveedor: { id: number; razonSocial: string; ruc: string };
    detalles: Array<{
      categoriaId: number | null;
      categoria: { id: number; nombre: string } | null;
    }>;
  }) {
    const categorias = new Set(
      comprobante.detalles
        .map((detalle) => detalle.categoria?.nombre)
        .filter((nombre): nombre is string => !!nombre),
    );

    return {
      id: comprobante.id,
      estado: comprobante.estado,
      numero: `${comprobante.establecimiento}-${comprobante.puntoEmision}-${comprobante.secuencial}`,
      rucEmisor: comprobante.rucEmisor,
      razonSocialEmisor: comprobante.razonSocialEmisor,
      proveedor: comprobante.proveedor,
      fechaEmision: comprobante.fechaEmision,
      subtotalSinImpuestos: comprobante.subtotalSinImpuestos.toFixed(2),
      iva: comprobante.iva.toFixed(2),
      importeTotal: comprobante.importeTotal.toFixed(2),
      categoria:
        categorias.size === 0
          ? 'Sin categorizar'
          : categorias.size === 1
            ? Array.from(categorias)[0]
            : 'Múltiples',
    };
  }

  private presentarCompleto(comprobante: {
    subtotalSinImpuestos: Decimal;
    totalDescuento: Decimal;
    iva: Decimal;
    importeTotal: Decimal;
    detalles: Array<{
      cantidad: Decimal;
      precioUnitario: Decimal;
      descuento: Decimal;
      baseImponible: Decimal;
      tarifaPorcentaje: Decimal;
      valorIva: Decimal;
      total: Decimal;
      confianza: Decimal | null;
    }>;
    [clave: string]: unknown;
  }) {
    return {
      ...comprobante,
      subtotalSinImpuestos: comprobante.subtotalSinImpuestos.toFixed(2),
      totalDescuento: comprobante.totalDescuento.toFixed(2),
      iva: comprobante.iva.toFixed(2),
      importeTotal: comprobante.importeTotal.toFixed(2),
      detalles: comprobante.detalles.map((detalle) => ({
        ...detalle,
        cantidad: detalle.cantidad.toFixed(6),
        precioUnitario: detalle.precioUnitario.toFixed(6),
        descuento: detalle.descuento.toFixed(2),
        baseImponible: detalle.baseImponible.toFixed(2),
        tarifaPorcentaje: detalle.tarifaPorcentaje.toFixed(2),
        valorIva: detalle.valorIva.toFixed(2),
        total: detalle.total.toFixed(2),
        confianza: detalle.confianza ? detalle.confianza.toFixed(2) : null,
      })),
    };
  }

  private convertirFechaInicial(fecha: string): Date {
    return new Date(`${fecha}T00:00:00.000-05:00`);
  }

  private convertirFechaFinal(fecha: string): Date {
    return new Date(`${fecha}T23:59:59.999-05:00`);
  }
}
