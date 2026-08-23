/**
 * Parser de facturas electrónicas del SRI Ecuador RECIBIDAS por el usuario
 * (comprobantes de compra/gasto que el propio contribuyente descarga desde
 * "SRI en Línea > Comprobantes Electrónicos Recibidos" y sube manualmente;
 * no existe una API pública para listarlas automáticamente).
 *
 * Estructura de etiquetas verificada contra el paquete `sri-ec` (ya usado
 * por el módulo `facturacion` para EMITIR facturas): mismo estándar XSD
 * `factura_v2.1.0.xsd`, confirmado línea a línea contra
 * `src/schemas/factura.schema.ts`, `src/schemas/shared.schema.ts` y
 * `src/xml/factura.serializer.ts` de ese paquete, y contra el uso real que
 * ya hace `facturacion/facturas.service.ts` (mismos nombres de etiqueta:
 * infoTributaria, infoFactura, totalConImpuestos, detalles > detalle >
 * impuestos, codigoPorcentaje, precioTotalSinImpuesto):
 *
 * <factura id="comprobante" version="2.1.0">
 *   <infoTributaria>
 *     <ambiente/><tipoEmision/><razonSocial/><nombreComercial/>?<ruc/>
 *     <claveAcceso/><codDoc/><estab/><ptoEmi/><secuencial/><dirMatriz/>
 *     <agenteRetencion/>?<contribuyenteRimpe/>?
 *   </infoTributaria>
 *   <infoFactura>
 *     <fechaEmision/> (DD/MM/YYYY) ... <totalSinImpuestos/> <totalDescuento/>
 *     <totalConImpuestos><totalImpuesto><codigo/><codigoPorcentaje/>
 *       <baseImponible/><valor/></totalImpuesto>...</totalConImpuestos>
 *     <propina/> <importeTotal/> <moneda/> <pagos>...</pagos>
 *   </infoFactura>
 *   <detalles>
 *     <detalle>
 *       <codigoPrincipal/>?<descripcion/><cantidad/><precioUnitario/>
 *       <descuento/><precioTotalSinImpuesto/>
 *       <impuestos><impuesto><codigo/><codigoPorcentaje/><tarifa/>
 *         <baseImponible/><valor/></impuesto>...</impuestos>
 *     </detalle>...
 *   </detalles>
 *   <infoAdicional>?...</infoAdicional>
 * </factura>
 *
 * El código de impuesto '2' identifica IVA en el catálogo SRI (mismo
 * literal que ya usa facturacion/facturas.service.ts al construir el XML
 * de una factura emitida); un detalle puede traer además ICE ('3') u otros
 * impuestos que este parser ignora porque no representan IVA.
 */

import { XMLParser } from 'fast-xml-parser';

import type {
  DetalleSriRecibido,
  ImpuestoDetalleSriRecibido,
  ResultadoParseoFacturaSriRecibida,
} from '../interfaces/factura-sri-recibida.interface';

const CODIGO_DOCUMENTO_FACTURA = '01';
const CODIGO_IMPUESTO_IVA = '2';

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (_nombre, jPath) =>
    jPath === 'factura.detalles.detalle' ||
    jPath === 'factura.detalles.detalle.impuestos.impuesto' ||
    jPath === 'factura.infoFactura.totalConImpuestos.totalImpuesto',
});

export function parsearFacturaSriRecibida(
  contenidoOriginal: string,
): ResultadoParseoFacturaSriRecibida {
  const contenido = desenvolverCdataSiAplica(contenidoOriginal);

  if (!/<factura\b/i.test(contenido)) {
    return {
      ok: false,
      motivo: 'No se reconoció como una factura electrónica del SRI',
    };
  }

  let documento: unknown;
  try {
    documento = parser.parse(contenido) as unknown;
  } catch {
    return { ok: false, motivo: 'El archivo no es un XML válido' };
  }

  const factura = obtenerObjeto(documento, 'factura');
  if (!factura) {
    return { ok: false, motivo: 'El XML no contiene un elemento <factura>' };
  }

  const infoTributaria = obtenerObjeto(factura, 'infoTributaria');
  const infoFactura = obtenerObjeto(factura, 'infoFactura');

  if (!infoTributaria || !infoFactura) {
    return {
      ok: false,
      motivo: 'Falta infoTributaria o infoFactura en el XML',
    };
  }

  const codDoc = obtenerTexto(infoTributaria, 'codDoc');
  if (codDoc !== CODIGO_DOCUMENTO_FACTURA) {
    return {
      ok: false,
      motivo:
        'El comprobante no es una factura (codDoc distinto de 01); no representa un gasto importable',
    };
  }

  const claveAcceso = obtenerTexto(infoTributaria, 'claveAcceso');
  if (!claveAcceso || !/^\d{49}$/.test(claveAcceso)) {
    return {
      ok: false,
      motivo: 'La clave de acceso no es válida (debe tener 49 dígitos)',
    };
  }

  const rucEmisor = obtenerTexto(infoTributaria, 'ruc');
  const razonSocialEmisor = obtenerTexto(infoTributaria, 'razonSocial');
  const establecimiento = obtenerTexto(infoTributaria, 'estab');
  const puntoEmision = obtenerTexto(infoTributaria, 'ptoEmi');
  const secuencial = obtenerTexto(infoTributaria, 'secuencial');

  if (
    !rucEmisor ||
    !razonSocialEmisor ||
    !establecimiento ||
    !puntoEmision ||
    !secuencial
  ) {
    return {
      ok: false,
      motivo: 'Falta un dato obligatorio en infoTributaria',
    };
  }

  const fechaEmisionTexto = obtenerTexto(infoFactura, 'fechaEmision');
  const totalSinImpuestosTexto = obtenerTexto(infoFactura, 'totalSinImpuestos');
  const totalDescuentoTexto = obtenerTexto(infoFactura, 'totalDescuento');
  const importeTotalTexto = obtenerTexto(infoFactura, 'importeTotal');

  if (!fechaEmisionTexto || !totalSinImpuestosTexto || !importeTotalTexto) {
    return {
      ok: false,
      motivo: 'Falta un dato obligatorio en infoFactura',
    };
  }

  const fechaEmision = parsearFechaDdMmAaaa(fechaEmisionTexto);
  if (!fechaEmision) {
    return { ok: false, motivo: 'La fecha de emisión no es válida' };
  }

  if (
    !esMontoValido(totalSinImpuestosTexto) ||
    !esMontoValido(importeTotalTexto)
  ) {
    return { ok: false, motivo: 'Los totales de la factura no son válidos' };
  }

  const iva = sumarIvaDeTotalConImpuestos(infoFactura);

  const { detalles, advertencia } = extraerDetalles(factura);

  return {
    ok: true,
    factura: {
      claveAcceso,
      rucEmisor: rucEmisor.trim(),
      razonSocialEmisor: razonSocialEmisor.trim(),
      nombreComercialEmisor:
        obtenerTexto(infoTributaria, 'nombreComercial')?.trim() ?? null,
      establecimiento: establecimiento.trim(),
      puntoEmision: puntoEmision.trim(),
      secuencial: secuencial.trim(),
      fechaEmision,
      subtotalSinImpuestos: totalSinImpuestosTexto,
      totalDescuento: esMontoValido(totalDescuentoTexto)
        ? totalDescuentoTexto
        : '0.00',
      iva,
      importeTotal: importeTotalTexto,
      detalles,
      advertencia,
    },
  };
}

function extraerDetalles(factura: Record<string, unknown>): {
  detalles: DetalleSriRecibido[];
  advertencia: string | null;
} {
  const detallesNodo = obtenerObjeto(factura, 'detalles');
  const listaDetalle = detallesNodo
    ? obtenerArreglo(detallesNodo, 'detalle')
    : null;

  if (!listaDetalle || listaDetalle.length === 0) {
    return {
      detalles: [],
      advertencia:
        'La factura no contiene líneas de detalle reconocibles (<detalles><detalle>...)',
    };
  }

  const detalles: DetalleSriRecibido[] = [];
  let descartados = 0;

  for (const nodo of listaDetalle) {
    const detalle = parsearUnDetalle(nodo);
    if (detalle) {
      detalles.push(detalle);
    } else {
      descartados += 1;
    }
  }

  if (detalles.length === 0) {
    return {
      detalles: [],
      advertencia: 'Ninguna línea de detalle pudo interpretarse correctamente',
    };
  }

  return {
    detalles,
    advertencia:
      descartados > 0
        ? `${descartados} línea(s) de detalle no pudieron interpretarse y se omitieron`
        : null,
  };
}

function parsearUnDetalle(nodo: unknown): DetalleSriRecibido | null {
  const detalle = comoObjeto(nodo);
  if (!detalle) return null;

  const descripcion = obtenerTexto(detalle, 'descripcion');
  const cantidad = obtenerTexto(detalle, 'cantidad');
  const precioUnitario = obtenerTexto(detalle, 'precioUnitario');
  const precioTotalSinImpuesto = obtenerTexto(
    detalle,
    'precioTotalSinImpuesto',
  );

  if (
    !descripcion ||
    !esMontoValido(cantidad) ||
    !esMontoValido(precioUnitario) ||
    !esMontoValido(precioTotalSinImpuesto)
  ) {
    return null;
  }

  const descuentoTexto = obtenerTexto(detalle, 'descuento');
  const impuestosNodo = obtenerArreglo(detalle, 'impuestos.impuesto');
  const impuestos = (impuestosNodo ?? [])
    .map((impuestoNodo) => parsearUnImpuesto(impuestoNodo))
    .filter((impuesto): impuesto is ImpuestoDetalleSriRecibido => !!impuesto);

  return {
    codigoPrincipal: obtenerTexto(detalle, 'codigoPrincipal')?.trim() ?? null,
    descripcion: descripcion.trim(),
    cantidad: cantidad,
    precioUnitario: precioUnitario,
    descuento: esMontoValido(descuentoTexto) ? descuentoTexto : '0.00',
    precioTotalSinImpuesto: precioTotalSinImpuesto,
    impuestos,
  };
}

function parsearUnImpuesto(nodo: unknown): ImpuestoDetalleSriRecibido | null {
  const impuesto = comoObjeto(nodo);
  if (!impuesto) return null;

  const codigo = obtenerTexto(impuesto, 'codigo');
  const codigoPorcentaje = obtenerTexto(impuesto, 'codigoPorcentaje');
  const tarifa = obtenerTexto(impuesto, 'tarifa');
  const baseImponible = obtenerTexto(impuesto, 'baseImponible');
  const valor = obtenerTexto(impuesto, 'valor');

  if (
    !codigo ||
    !codigoPorcentaje ||
    !esMontoValido(tarifa) ||
    !esMontoValido(baseImponible) ||
    !esMontoValido(valor)
  ) {
    return null;
  }

  return {
    codigo,
    codigoPorcentaje,
    tarifa: tarifa,
    baseImponible: baseImponible,
    valor: valor,
  };
}

/**
 * Suma únicamente los totalImpuesto con código de impuesto IVA ('2'); un
 * comprobante puede traer además ICE u otros impuestos que no son IVA.
 */
function sumarIvaDeTotalConImpuestos(
  infoFactura: Record<string, unknown>,
): string {
  const nodo = obtenerObjeto(infoFactura, 'totalConImpuestos');
  const lista = nodo ? obtenerArreglo(nodo, 'totalImpuesto') : null;

  if (!lista) return '0.00';

  let total = 0;
  for (const item of lista) {
    const totalImpuesto = comoObjeto(item);
    if (!totalImpuesto) continue;

    const codigo = obtenerTexto(totalImpuesto, 'codigo');
    const valor = obtenerTexto(totalImpuesto, 'valor');

    if (codigo === CODIGO_IMPUESTO_IVA && esMontoValido(valor)) {
      total += Number(valor);
    }
  }

  return total.toFixed(2);
}

function desenvolverCdataSiAplica(contenido: string): string {
  const coincidencia = contenido.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return coincidencia ? coincidencia[1] : contenido;
}

function parsearFechaDdMmAaaa(texto: string): Date | null {
  const partes = texto.trim().split('/');
  if (partes.length !== 3) return null;

  const [diaTexto, mesTexto, anioTexto] = partes;
  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const anio = Number(anioTexto);

  if (!dia || !mes || !anio) return null;

  // Se fija el mediodía en horario de Ecuador para evitar que un cambio de
  // huso horario recorra la fecha al día anterior o siguiente (mismo
  // enfoque que ya usaba movimientos/utilidades/importar-facturas-sri.ts).
  const fecha = new Date(
    `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00.000-05:00`,
  );

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function esMontoValido(texto: string | null | undefined): texto is string {
  if (!texto) return false;
  const numero = Number(texto);
  return Number.isFinite(numero);
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function obtenerObjeto(
  valor: unknown,
  clave: string,
): Record<string, unknown> | null {
  const objeto = comoObjeto(valor);
  if (!objeto) return null;
  return comoObjeto(objeto[clave]);
}

/**
 * Extrae un valor de texto de una etiqueta simple. fast-xml-parser entrega
 * el texto directamente como string (parseTagValue: false), o `undefined`
 * si la etiqueta no existe.
 */
function obtenerTexto(
  objeto: Record<string, unknown>,
  clave: string,
): string | undefined {
  const valor = objeto[clave];
  return typeof valor === 'string' ? valor : undefined;
}

/**
 * Obtiene un arreglo a partir de una ruta con puntos (por ejemplo
 * "impuestos.impuesto"), resolviendo cada nivel intermedio como objeto.
 * Gracias a la opción `isArray` del parser, las rutas configuradas siempre
 * llegan como arreglo (incluso con un solo elemento); si la etiqueta no
 * existe del todo, devuelve null.
 */
function obtenerArreglo(
  objeto: Record<string, unknown>,
  rutaConPuntos: string,
): unknown[] | null {
  const partes = rutaConPuntos.split('.');
  let actual: unknown = objeto;

  for (const parte of partes) {
    const actualObjeto = comoObjeto(actual);
    if (!actualObjeto) return null;
    actual = actualObjeto[parte];
  }

  return Array.isArray(actual) ? actual : null;
}
