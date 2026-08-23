import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { CalcularImpuestoRentaDto } from './dto/calcular-impuesto-renta.dto';
import { ConfigurarCategoriaTributariaDto } from './dto/configurar-categoria-tributaria.dto';
import {
  calcularImpuestoPersonaNaturalGeneral,
  calcularImpuestoRimpe,
  calcularRebajaGastosPersonales,
} from './utilidades/calculadora-impuesto-renta';
import {
  obtenerRangoAnualEcuador,
  obtenerRangoMensualEcuador,
} from './utilidades/fecha-ecuador';

/** Prellenado del Formulario 104 (IVA) para un mes, calculado a partir de datos ya registrados en Fintech. */
export interface PrellenadoFormulario104 {
  periodo: { anio: number; mes: number };
  ventasGravadas15: string;
  ventasGravadas0: string;
  impuestoGeneradoVentas: string;
  comprasGravadas15: string;
  retencionesIvaRecibidas: string;
  fuentes: {
    facturasEmitidasConsideradas: number;
    comprobantesRecibidosConsiderados: number;
    retencionesConsideradas: number;
  };
  advertencia: string;
}

interface DatosResumenTributario {
  perfil: {
    id: number;
    tipoContribuyente: string;
    regimenTributario: string;
  };
  ingresosFacturados: Decimal;
  ivaVentas: Decimal;
  cobrosFintech: Decimal;
  pagosFintech: Decimal;
  ingresosGravadosFintech: Decimal;
  ingresosExentosFintech: Decimal;
  gastosDeducibles: Decimal;
  gastosPersonales: Decimal;
  gastosNoDeducibles: Decimal;
  montoIgnorado: Decimal;
  gastosPersonalesPorCategoria: Map<string, Decimal>;
  retencionesRenta: Decimal;
  retencionesIva: Decimal;
  cantidadFacturas: number;
  cantidadMovimientos: number;
}

@Injectable()
export class ResumenTributarioService {
  constructor(private readonly prismaService: PrismaService) {}

  async configurarCategoria(
    usuarioId: number,
    dto: ConfigurarCategoriaTributariaDto,
  ) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const categoria = await this.prismaService.categoria.findUnique({
      where: { id: dto.categoriaId },
      select: { id: true, nombre: true, tipo: true, activa: true },
    });

    if (!categoria || !categoria.activa) {
      throw new NotFoundException(
        'La categoría financiera no existe o está inactiva',
      );
    }

    if (
      dto.tratamiento === 'GASTO_PERSONAL' &&
      dto.categoriaGastoPersonal === undefined
    ) {
      throw new BadRequestException(
        'Debe indicar el rubro cuando el tratamiento es GASTO_PERSONAL',
      );
    }

    if (
      dto.tratamiento !== 'GASTO_PERSONAL' &&
      dto.categoriaGastoPersonal !== undefined
    ) {
      throw new BadRequestException(
        'El rubro personal solo se utiliza con tratamiento GASTO_PERSONAL',
      );
    }

    if (
      categoria.tipo === 'INGRESO' &&
      ['COSTO_GASTO_DEDUCIBLE', 'GASTO_PERSONAL', 'NO_DEDUCIBLE'].includes(
        dto.tratamiento,
      )
    ) {
      throw new BadRequestException(
        'Una categoría de ingreso no puede configurarse como gasto',
      );
    }

    if (
      categoria.tipo === 'GASTO' &&
      ['INGRESO_GRAVADO', 'INGRESO_EXENTO'].includes(dto.tratamiento)
    ) {
      throw new BadRequestException(
        'Una categoría de gasto no puede configurarse como ingreso',
      );
    }

    const configuracion =
      await this.prismaService.configuracionCategoriaTributaria.upsert({
        where: {
          perfilTributarioId_categoriaId: {
            perfilTributarioId: perfil.id,
            categoriaId: categoria.id,
          },
        },
        create: {
          perfilTributarioId: perfil.id,
          categoriaId: categoria.id,
          tratamiento: dto.tratamiento,
          categoriaGastoPersonal: dto.categoriaGastoPersonal,
        },
        update: {
          tratamiento: dto.tratamiento,
          categoriaGastoPersonal:
            dto.tratamiento === 'GASTO_PERSONAL'
              ? dto.categoriaGastoPersonal
              : null,
        },
      });

    return {
      mensaje: 'Categoría financiera configurada para tributación',
      configuracion: {
        ...configuracion,
        categoria,
      },
    };
  }

  async listarConfiguraciones(usuarioId: number) {
    const perfil = await this.obtenerPerfil(usuarioId);
    const configuraciones =
      await this.prismaService.configuracionCategoriaTributaria.findMany({
        where: { perfilTributarioId: perfil.id },
        orderBy: { categoriaId: 'asc' },
      });
    const categorias = await this.prismaService.categoria.findMany({
      where: { id: { in: configuraciones.map((item) => item.categoriaId) } },
      select: { id: true, nombre: true, tipo: true, activa: true },
    });
    const categoriasPorId = new Map(
      categorias.map((categoria) => [categoria.id, categoria] as const),
    );

    return {
      total: configuraciones.length,
      configuraciones: configuraciones.map((configuracion) => ({
        ...configuracion,
        categoria: categoriasPorId.get(configuracion.categoriaId) ?? null,
      })),
    };
  }

  async obtenerResumen(usuarioId: number, anio: number) {
    this.validarAnio(anio);
    const datos = await this.obtenerDatos(usuarioId, anio);

    return {
      anio,
      ingresosTributarios: {
        facturasAutorizadas: datos.cantidadFacturas,
        totalSinImpuestos: datos.ingresosFacturados.toFixed(2),
        ivaGenerado: datos.ivaVentas.toFixed(2),
        totalFacturado: datos.ingresosFacturados
          .plus(datos.ivaVentas)
          .toFixed(2),
      },
      flujoFintech: {
        movimientosConsiderados: datos.cantidadMovimientos,
        ingresos: datos.cobrosFintech.toFixed(2),
        gastos: datos.pagosFintech.toFixed(2),
        flujoNeto: datos.cobrosFintech.minus(datos.pagosFintech).toFixed(2),
      },
      clasificacionTributariaFintech: {
        ingresosGravadosMarcados: datos.ingresosGravadosFintech.toFixed(2),
        ingresosExentosMarcados: datos.ingresosExentosFintech.toFixed(2),
        costosGastosDeducibles: datos.gastosDeducibles.toFixed(2),
        gastosPersonales: datos.gastosPersonales.toFixed(2),
        gastosNoDeducibles: datos.gastosNoDeducibles.toFixed(2),
        montoIgnorado: datos.montoIgnorado.toFixed(2),
        gastosPersonalesPorCategoria: Object.fromEntries(
          [...datos.gastosPersonalesPorCategoria.entries()].map(
            ([categoria, valor]) => [categoria, valor.toFixed(2)],
          ),
        ),
      },
      creditosPorRetenciones: {
        renta: datos.retencionesRenta.toFixed(2),
        iva: datos.retencionesIva.toFixed(2),
      },
      advertencias: [
        'Flujo Fintech e ingresos facturados son mediciones diferentes y no deben sumarse entre sí.',
        'Un movimiento marcado como gasto deducible o personal debe conservar un comprobante válido como respaldo.',
        'Este resumen es informativo y no reemplaza la declaración presentada en SRI en Línea.',
      ],
    };
  }

  async calcularImpuestoRenta(
    usuarioId: number,
    anio: number,
    dto: CalcularImpuestoRentaDto,
  ) {
    this.validarAnio(anio);
    const datos = await this.obtenerDatos(usuarioId, anio);
    const otrosIngresos = new Decimal(dto.otrosIngresosGravados ?? 0);
    const aporteIess = new Decimal(dto.aporteIess ?? 0);
    const otrasDeducciones = new Decimal(dto.otrasDeducciones ?? 0);
    const otrosCreditos = new Decimal(dto.otrosCreditosTributarios ?? 0);
    const ingresosGravados = datos.ingresosFacturados.plus(otrosIngresos);
    const advertencias: string[] = [
      'Resultado estimado: la obligación definitiva se determina en la declaración del SRI.',
    ];

    if (datos.perfil.regimenTributario.startsWith('RIMPE')) {
      const impuestoCausado = new Decimal(
        calcularImpuestoRimpe(anio, ingresosGravados),
      );
      const impuestoPorPagar = Decimal.max(
        impuestoCausado.minus(datos.retencionesRenta).minus(otrosCreditos),
        0,
      );

      return {
        anio,
        regimen: datos.perfil.regimenTributario,
        tipoContribuyente: datos.perfil.tipoContribuyente,
        ingresosBrutos: ingresosGravados.toFixed(2),
        impuestoCausado: impuestoCausado.toFixed(2),
        retencionesRenta: datos.retencionesRenta.toFixed(2),
        otrosCreditosTributarios: otrosCreditos.toFixed(2),
        impuestoEstimadoPorPagar: impuestoPorPagar.toFixed(2),
        advertencias,
      };
    }

    const baseSinAportePersonal = Decimal.max(
      ingresosGravados.minus(datos.gastosDeducibles).minus(otrasDeducciones),
      0,
    );

    if (datos.perfil.tipoContribuyente === 'SOCIEDAD') {
      const impuestoCausado = baseSinAportePersonal
        .times(25)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const impuestoPorPagar = Decimal.max(
        impuestoCausado.minus(datos.retencionesRenta).minus(otrosCreditos),
        0,
      );
      advertencias.push(
        'La tarifa general de sociedades es 25 %, pero puede variar por composición societaria, reinversión, nueva inversión u otros beneficios y recargos.',
      );

      return {
        anio,
        regimen: 'GENERAL',
        tipoContribuyente: 'SOCIEDAD',
        ingresosGravados: ingresosGravados.toFixed(2),
        gastosDeducibles: datos.gastosDeducibles.toFixed(2),
        otrasDeducciones: otrasDeducciones.toFixed(2),
        baseImponible: baseSinAportePersonal.toFixed(2),
        tarifaReferencial: '25.00',
        impuestoCausado: impuestoCausado.toFixed(2),
        retencionesRenta: datos.retencionesRenta.toFixed(2),
        otrosCreditosTributarios: otrosCreditos.toFixed(2),
        impuestoEstimadoPorPagar: impuestoPorPagar.toFixed(2),
        advertencias,
      };
    }

    const baseImponible = Decimal.max(
      baseSinAportePersonal.minus(aporteIess),
      0,
    );

    const calculoTabla = calcularImpuestoPersonaNaturalGeneral(
      anio,
      baseImponible,
    );
    const impuestoAntesRebaja = new Decimal(calculoTabla.impuestoCausado);
    let rebaja = new Decimal(0);
    let detalleRebaja: ReturnType<
      typeof calcularRebajaGastosPersonales
    > | null = null;

    if (dto.canastaBasicaMensual !== undefined) {
      detalleRebaja = calcularRebajaGastosPersonales(
        datos.gastosPersonales,
        dto.canastaBasicaMensual,
        dto.cargasFamiliares ?? 0,
        dto.enfermedadCatastrofica ?? false,
      );
      rebaja = new Decimal(detalleRebaja.rebaja);
    } else {
      advertencias.push(
        'No se aplicó rebaja por gastos personales porque falta canastaBasicaMensual. Para el cierre anual debe usar la canasta de diciembre.',
      );
    }

    const impuestoDespuesRebaja = Decimal.max(
      impuestoAntesRebaja.minus(rebaja),
      0,
    );
    const impuestoPorPagar = Decimal.max(
      impuestoDespuesRebaja.minus(datos.retencionesRenta).minus(otrosCreditos),
      0,
    );

    return {
      anio,
      regimen: 'GENERAL',
      tipoContribuyente: 'PERSONA_NATURAL',
      ingresosGravados: ingresosGravados.toFixed(2),
      costosGastosDeducibles: datos.gastosDeducibles.toFixed(2),
      aporteIess: aporteIess.toFixed(2),
      otrasDeducciones: otrasDeducciones.toFixed(2),
      baseImponible: baseImponible.toFixed(2),
      calculoTabla,
      gastosPersonalesRegistrados: datos.gastosPersonales.toFixed(2),
      detalleRebaja,
      impuestoDespuesRebaja: impuestoDespuesRebaja.toFixed(2),
      retencionesRenta: datos.retencionesRenta.toFixed(2),
      otrosCreditosTributarios: otrosCreditos.toFixed(2),
      impuestoEstimadoPorPagar: impuestoPorPagar.toFixed(2),
      saldoAFavorEstimado: Decimal.max(
        datos.retencionesRenta.plus(otrosCreditos).minus(impuestoDespuesRebaja),
        0,
      ).toFixed(2),
      advertencias,
    };
  }

  /**
   * Prellenado del Formulario 104 (IVA) para un mes específico, calculado a
   * partir de lo que el usuario ya tiene registrado en Fintech: sus facturas
   * electrónicas emitidas (casilleros 401/403/429), los comprobantes de
   * compra recibidos con tarifa distinta de cero (casillero 500) y las
   * retenciones de IVA que le han sido efectuadas (casillero 609). No
   * reemplaza la revisión del usuario: si falta registrar algún documento
   * del mes, el resultado quedará incompleto.
   */
  async obtenerPrellenadoFormulario104(
    usuarioId: number,
    anio: number,
    mes: number,
  ): Promise<PrellenadoFormulario104> {
    this.validarAnio(anio);
    const perfil = await this.obtenerPerfil(usuarioId);
    const rango = obtenerRangoMensualEcuador(anio, mes);

    const [facturas, comprasGravadas, comprobantesGravados, retenciones] =
      await Promise.all([
        this.prismaService.facturaElectronica.aggregate({
          where: {
            perfilTributarioId: perfil.id,
            estado: 'AUTORIZADA',
            fechaEmision: { gte: rango.fechaDesde, lt: rango.fechaHastaExclusiva },
          },
          _count: { id: true },
          _sum: { subtotalCero: true, subtotalQuince: true, iva: true },
        }),
        this.prismaService.detalleComprobanteRecibido.aggregate({
          where: {
            tarifaPorcentaje: { gt: 0 },
            comprobanteRecibido: {
              usuarioId,
              estado: 'PROCESADO',
              fechaEmision: { gte: rango.fechaDesde, lt: rango.fechaHastaExclusiva },
            },
          },
          _sum: { baseImponible: true },
        }),
        this.prismaService.comprobanteRecibido.count({
          where: {
            usuarioId,
            estado: 'PROCESADO',
            fechaEmision: { gte: rango.fechaDesde, lt: rango.fechaHastaExclusiva },
            detalles: { some: { tarifaPorcentaje: { gt: 0 } } },
          },
        }),
        this.prismaService.retencionRecibida.aggregate({
          where: {
            perfilTributarioId: perfil.id,
            tipo: 'IVA',
            activo: true,
            fechaEmision: { gte: rango.fechaDesde, lt: rango.fechaHastaExclusiva },
          },
          _count: { id: true },
          _sum: { valor: true },
        }),
      ]);

    return {
      periodo: { anio, mes },
      ventasGravadas15: new Decimal(
        facturas._sum.subtotalQuince?.toString() ?? 0,
      ).toFixed(2),
      ventasGravadas0: new Decimal(
        facturas._sum.subtotalCero?.toString() ?? 0,
      ).toFixed(2),
      impuestoGeneradoVentas: new Decimal(
        facturas._sum.iva?.toString() ?? 0,
      ).toFixed(2),
      comprasGravadas15: new Decimal(
        comprasGravadas._sum.baseImponible?.toString() ?? 0,
      ).toFixed(2),
      retencionesIvaRecibidas: new Decimal(
        retenciones._sum.valor?.toString() ?? 0,
      ).toFixed(2),
      fuentes: {
        facturasEmitidasConsideradas: facturas._count.id,
        comprobantesRecibidosConsiderados: comprobantesGravados,
        retencionesConsideradas: retenciones._count.id,
      },
      advertencia:
        'Estos montos se calcularon con tus facturas electrónicas, comprobantes de compra y retenciones ya registrados en Fintech para este mes. Revísalos antes de generar el borrador: si falta algún documento por registrar o importar, el resultado quedará incompleto.',
    };
  }

  private async obtenerDatos(
    usuarioId: number,
    anio: number,
  ): Promise<DatosResumenTributario> {
    const perfil = await this.obtenerPerfil(usuarioId);
    const rango = obtenerRangoAnualEcuador(anio);

    const [facturas, movimientos, configuraciones, retenciones] =
      await Promise.all([
        this.prismaService.facturaElectronica.aggregate({
          where: {
            perfilTributarioId: perfil.id,
            estado: 'AUTORIZADA',
            fechaEmision: {
              gte: rango.fechaDesde,
              lt: rango.fechaHastaExclusiva,
            },
          },
          _count: { id: true },
          _sum: { totalSinImpuestos: true, iva: true },
        }),
        this.prismaService.movimiento.groupBy({
          by: ['tipo', 'categoriaId'],
          where: {
            usuarioId,
            eliminadoEn: null,
            fecha: {
              gte: rango.fechaDesde,
              lt: rango.fechaHastaExclusiva,
            },
          },
          _count: { id: true },
          _sum: { monto: true },
        }),
        this.prismaService.configuracionCategoriaTributaria.findMany({
          where: { perfilTributarioId: perfil.id },
        }),
        this.prismaService.retencionRecibida.groupBy({
          by: ['tipo'],
          where: {
            perfilTributarioId: perfil.id,
            activo: true,
            fechaEmision: {
              gte: rango.fechaDesde,
              lt: rango.fechaHastaExclusiva,
            },
          },
          _sum: { valor: true },
        }),
      ]);

    const configuracionesPorCategoria = new Map(
      configuraciones.map(
        (configuracion) => [configuracion.categoriaId, configuracion] as const,
      ),
    );
    const gastosPersonalesPorCategoria = new Map<string, Decimal>();
    let cobrosFintech = new Decimal(0);
    let pagosFintech = new Decimal(0);
    let ingresosGravadosFintech = new Decimal(0);
    let ingresosExentosFintech = new Decimal(0);
    let gastosDeducibles = new Decimal(0);
    let gastosPersonales = new Decimal(0);
    let gastosNoDeducibles = new Decimal(0);
    let montoIgnorado = new Decimal(0);
    let cantidadMovimientos = 0;

    for (const movimiento of movimientos) {
      const monto = new Decimal(movimiento._sum.monto?.toString() ?? 0);
      cantidadMovimientos += movimiento._count.id;

      if (movimiento.tipo === 'INGRESO') {
        cobrosFintech = cobrosFintech.plus(monto);
      } else {
        pagosFintech = pagosFintech.plus(monto);
      }

      const configuracion = configuracionesPorCategoria.get(
        movimiento.categoriaId,
      );

      if (configuracion?.tratamiento === 'INGRESO_GRAVADO') {
        ingresosGravadosFintech = ingresosGravadosFintech.plus(monto);
      }

      if (configuracion?.tratamiento === 'INGRESO_EXENTO') {
        ingresosExentosFintech = ingresosExentosFintech.plus(monto);
      }

      if (configuracion?.tratamiento === 'COSTO_GASTO_DEDUCIBLE') {
        gastosDeducibles = gastosDeducibles.plus(monto);
      }

      if (configuracion?.tratamiento === 'NO_DEDUCIBLE') {
        gastosNoDeducibles = gastosNoDeducibles.plus(monto);
      }

      if (configuracion?.tratamiento === 'IGNORAR') {
        montoIgnorado = montoIgnorado.plus(monto);
      }

      if (
        configuracion?.tratamiento === 'GASTO_PERSONAL' &&
        configuracion.categoriaGastoPersonal !== null
      ) {
        gastosPersonales = gastosPersonales.plus(monto);
        const acumulado =
          gastosPersonalesPorCategoria.get(
            configuracion.categoriaGastoPersonal,
          ) ?? new Decimal(0);
        gastosPersonalesPorCategoria.set(
          configuracion.categoriaGastoPersonal,
          acumulado.plus(monto),
        );
      }
    }

    const retencionesPorTipo = new Map(
      retenciones.map(
        (retencion) =>
          [
            retencion.tipo,
            new Decimal(retencion._sum.valor?.toString() ?? 0),
          ] as const,
      ),
    );

    return {
      perfil,
      ingresosFacturados: new Decimal(
        facturas._sum.totalSinImpuestos?.toString() ?? 0,
      ),
      ivaVentas: new Decimal(facturas._sum.iva?.toString() ?? 0),
      cobrosFintech,
      pagosFintech,
      ingresosGravadosFintech,
      ingresosExentosFintech,
      gastosDeducibles,
      gastosPersonales,
      gastosNoDeducibles,
      montoIgnorado,
      gastosPersonalesPorCategoria,
      retencionesRenta: retencionesPorTipo.get('RENTA') ?? new Decimal(0),
      retencionesIva: retencionesPorTipo.get('IVA') ?? new Decimal(0),
      cantidadFacturas: facturas._count.id,
      cantidadMovimientos,
    };
  }

  private async obtenerPerfil(usuarioId: number) {
    const perfil = await this.prismaService.perfilTributario.findFirst({
      where: { usuarioId, activo: true },
      select: {
        id: true,
        tipoContribuyente: true,
        regimenTributario: true,
      },
    });

    if (!perfil) {
      throw new NotFoundException('Primero debe crear el perfil tributario');
    }

    return perfil;
  }

  private validarAnio(anio: number): void {
    if (!Number.isInteger(anio) || anio < 2020 || anio > 9999) {
      throw new BadRequestException('El año solicitado no es válido');
    }
  }
}
