/**
 * Estructura de una <factura> del SRI Ecuador ya parseada, tal como la
 * necesita el módulo de comprobantes recibidos. Los campos monetarios y de
 * cantidad se conservan como texto (el mismo formato decimal que trae el
 * XML) para no perder precisión al pasarlos directamente a un campo
 * Prisma Decimal; solo se convierten a Number de forma transitoria para
 * validarlos.
 */

export interface ImpuestoDetalleSriRecibido {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: string;
  baseImponible: string;
  valor: string;
}

export interface DetalleSriRecibido {
  codigoPrincipal: string | null;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  precioTotalSinImpuesto: string;
  impuestos: ImpuestoDetalleSriRecibido[];
}

export interface FacturaSriRecibida {
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor: string | null;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  fechaEmision: Date;
  subtotalSinImpuestos: string;
  totalDescuento: string;
  iva: string;
  importeTotal: string;
  detalles: DetalleSriRecibido[];

  /**
   * Presente cuando el encabezado se reconoció correctamente pero no se
   * pudieron extraer (todos o algunos de) los detalles; el servicio la
   * convierte en estado ERROR_XML en vez de descartar el comprobante.
   */
  advertencia: string | null;
}

export type ResultadoParseoFacturaSriRecibida =
  { ok: true; factura: FacturaSriRecibida } | { ok: false; motivo: string };
