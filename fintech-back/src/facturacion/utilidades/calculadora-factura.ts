import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

export type TarifaIvaCalculable = 'CERO' | 'QUINCE';

export interface EntradaDetalleCalculo {
  productoServicioId: number;
  codigoPrincipal: string;
  descripcion: string;
  precioUnitario: string;
  tarifaIva: TarifaIvaCalculable;
  cantidad: string;
  descuento?: string;
}

export interface DetalleFacturaCalculado {
  productoServicioId: number;
  codigoPrincipal: string;
  descripcion: string;
  precioUnitario: string;
  tarifaIva: TarifaIvaCalculable;
  cantidad: string;
  descuento: string;
  baseImponible: string;
  valorIva: string;
  total: string;
}

export interface TotalesFacturaCalculados {
  subtotalCero: string;
  subtotalQuince: string;
  totalSinImpuestos: string;
  totalDescuento: string;
  iva: string;
  importeTotal: string;
  detalles: DetalleFacturaCalculado[];
}

const PORCENTAJE_IVA_QUINCE = new Decimal(15);
const CIEN = new Decimal(100);

/**
 * Calcula todos los importes en el servidor utilizando aritmética decimal.
 * El frontend solamente envía cantidades y descuentos; nunca impone totales.
 */
export function calcularTotalesFactura(
  entradas: EntradaDetalleCalculo[],
): TotalesFacturaCalculados {
  let subtotalCero = new Decimal(0);
  let subtotalQuince = new Decimal(0);
  let totalDescuento = new Decimal(0);
  let iva = new Decimal(0);

  const detalles = entradas.map((entrada) => {
    const cantidad = new Decimal(entrada.cantidad);
    const precioUnitario = new Decimal(entrada.precioUnitario);
    const descuento = new Decimal(entrada.descuento ?? '0');
    const valorBruto = cantidad.times(precioUnitario);

    if (descuento.greaterThan(valorBruto)) {
      throw new BadRequestException(
        `El descuento del producto ${entrada.codigoPrincipal} no puede superar el valor bruto de la línea`,
      );
    }

    const baseImponible = valorBruto
      .minus(descuento)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const valorIva =
      entrada.tarifaIva === 'QUINCE'
        ? baseImponible
            .times(PORCENTAJE_IVA_QUINCE)
            .dividedBy(CIEN)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal(0);

    const total = baseImponible.plus(valorIva);

    if (entrada.tarifaIva === 'QUINCE') {
      subtotalQuince = subtotalQuince.plus(baseImponible);
    } else {
      subtotalCero = subtotalCero.plus(baseImponible);
    }

    totalDescuento = totalDescuento.plus(descuento);
    iva = iva.plus(valorIva);

    return {
      productoServicioId: entrada.productoServicioId,
      codigoPrincipal: entrada.codigoPrincipal,
      descripcion: entrada.descripcion,
      cantidad: cantidad.toFixed(6),
      precioUnitario: precioUnitario.toFixed(6),
      descuento: descuento.toFixed(2),
      tarifaIva: entrada.tarifaIva,
      baseImponible: baseImponible.toFixed(2),
      valorIva: valorIva.toFixed(2),
      total: total.toFixed(2),
    };
  });

  const totalSinImpuestos = subtotalCero.plus(subtotalQuince);
  const importeTotal = totalSinImpuestos.plus(iva);

  if (importeTotal.greaterThan('999999999999.99')) {
    throw new BadRequestException(
      'El total de la factura excede el máximo permitido',
    );
  }

  return {
    subtotalCero: subtotalCero.toFixed(2),
    subtotalQuince: subtotalQuince.toFixed(2),
    totalSinImpuestos: totalSinImpuestos.toFixed(2),
    totalDescuento: totalDescuento.toFixed(2),
    iva: iva.toFixed(2),
    importeTotal: importeTotal.toFixed(2),
    detalles,
  };
}
