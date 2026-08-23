import { describe, expect, it } from 'vitest';

import { parsearFacturaSriRecibida } from '../utilidades/parser-factura-sri-recibida';

interface DetalleFixture {
  codigoPrincipal?: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento?: string;
  precioTotalSinImpuesto: string;
  impuestos: Array<{
    codigo: string;
    codigoPorcentaje: string;
    tarifa: string;
    baseImponible: string;
    valor: string;
  }>;
}

/**
 * Genera el XML de una <factura> v2.1.0 real (mismas etiquetas que ya usa
 * facturacion/facturas.service.ts al emitir), con los detalles indicados.
 * Sirve como fixture para todos los casos de esta suite.
 */
function construirFacturaXml(opciones: {
  claveAcceso?: string;
  ruc?: string;
  razonSocial?: string;
  fechaEmision?: string;
  totalSinImpuestos?: string;
  importeTotal?: string;
  totalConImpuestos?: Array<{
    codigo: string;
    codigoPorcentaje: string;
    baseImponible: string;
    valor: string;
  }>;
  detalles?: DetalleFixture[];
  omitirDetalles?: boolean;
}): string {
  const claveAcceso = opciones.claveAcceso ?? '1'.repeat(49);
  const detalles = opciones.detalles ?? [
    {
      descripcion: 'Arroz',
      cantidad: '2.000000',
      precioUnitario: '3.500000',
      precioTotalSinImpuesto: '7.00',
      impuestos: [
        {
          codigo: '2',
          codigoPorcentaje: '0',
          tarifa: '0.00',
          baseImponible: '7.00',
          valor: '0.00',
        },
      ],
    },
  ];

  const detallesXml = opciones.omitirDetalles
    ? ''
    : `<detalles>${detalles
        .map(
          (d) => `<detalle>
      ${d.codigoPrincipal ? `<codigoPrincipal>${d.codigoPrincipal}</codigoPrincipal>` : ''}
      <descripcion>${d.descripcion}</descripcion>
      <cantidad>${d.cantidad}</cantidad>
      <precioUnitario>${d.precioUnitario}</precioUnitario>
      <descuento>${d.descuento ?? '0.00'}</descuento>
      <precioTotalSinImpuesto>${d.precioTotalSinImpuesto}</precioTotalSinImpuesto>
      <impuestos>${d.impuestos
        .map(
          (i) => `<impuesto>
          <codigo>${i.codigo}</codigo>
          <codigoPorcentaje>${i.codigoPorcentaje}</codigoPorcentaje>
          <tarifa>${i.tarifa}</tarifa>
          <baseImponible>${i.baseImponible}</baseImponible>
          <valor>${i.valor}</valor>
        </impuesto>`,
        )
        .join('')}</impuestos>
    </detalle>`,
        )
        .join('')}</detalles>`;

  const totalConImpuestos = opciones.totalConImpuestos ?? [
    {
      codigo: '2',
      codigoPorcentaje: '0',
      baseImponible: '7.00',
      valor: '0.00',
    },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${opciones.razonSocial ?? 'Supermercado XYZ'}</razonSocial>
    <ruc>${opciones.ruc ?? '0999999999001'}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000014806</secuencial>
    <dirMatriz>Av. Siempre Viva 123</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${opciones.fechaEmision ?? '16/08/2026'}</fechaEmision>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>05</tipoIdentificacionComprador>
    <razonSocialComprador>Consumidor Final</razonSocialComprador>
    <identificacionComprador>9999999999999</identificacionComprador>
    <totalSinImpuestos>${opciones.totalSinImpuestos ?? '7.00'}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>${totalConImpuestos
      .map(
        (t) => `<totalImpuesto>
        <codigo>${t.codigo}</codigo>
        <codigoPorcentaje>${t.codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${t.baseImponible}</baseImponible>
        <valor>${t.valor}</valor>
      </totalImpuesto>`,
      )
      .join('')}</totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${opciones.importeTotal ?? '7.00'}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos><pago><formaPago>01</formaPago><total>7.00</total></pago></pagos>
  </infoFactura>
  ${detallesXml}
</factura>`;
}

describe('parsearFacturaSriRecibida', () => {
  it('parsea una factura válida con un solo detalle', () => {
    const resultado = parsearFacturaSriRecibida(construirFacturaXml({}));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.factura.claveAcceso).toBe('1'.repeat(49));
    expect(resultado.factura.rucEmisor).toBe('0999999999001');
    expect(resultado.factura.razonSocialEmisor).toBe('Supermercado XYZ');
    expect(resultado.factura.importeTotal).toBe('7.00');
    expect(resultado.factura.detalles).toHaveLength(1);
    expect(resultado.factura.detalles[0].descripcion).toBe('Arroz');
    expect(resultado.factura.advertencia).toBeNull();
  });

  it('parsea varias facturas de forma independiente (un lote)', () => {
    const xmls = [
      construirFacturaXml({
        claveAcceso: '1'.repeat(49),
        razonSocial: 'Proveedor A',
      }),
      construirFacturaXml({
        claveAcceso: '2'.repeat(49),
        razonSocial: 'Proveedor B',
      }),
      construirFacturaXml({
        claveAcceso: '3'.repeat(49),
        razonSocial: 'Proveedor C',
      }),
    ];

    const resultados = xmls.map((xml) => parsearFacturaSriRecibida(xml));

    expect(resultados.every((r) => r.ok)).toBe(true);
    const claves = resultados.map((r) => (r.ok ? r.factura.claveAcceso : null));
    expect(new Set(claves).size).toBe(3);
  });

  it('un mismo XML importado dos veces produce la misma claveAcceso (la detección de duplicados la hace el servicio, no el parser)', () => {
    const xml = construirFacturaXml({ claveAcceso: '7'.repeat(49) });

    const primero = parsearFacturaSriRecibida(xml);
    const segundo = parsearFacturaSriRecibida(xml);

    expect(primero.ok && segundo.ok).toBe(true);
    if (primero.ok && segundo.ok) {
      expect(primero.factura.claveAcceso).toBe(segundo.factura.claveAcceso);
    }
  });

  it('rechaza un XML inválido / que no es una factura del SRI', () => {
    const resultado = parsearFacturaSriRecibida(
      '<html><body>esto no es una factura</body></html>',
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toContain('No se reconoció');
  });

  it('rechaza un XML con etiquetas mal formadas', () => {
    const resultado = parsearFacturaSriRecibida(
      '<factura><infoTributaria><ruc>123',
    );

    // No debe lanzar una excepción; debe devolver un resultado controlado.
    expect(resultado.ok).toBe(false);
  });

  it('reconoce el encabezado de una factura sin líneas de detalle y lo marca con advertencia', () => {
    const resultado = parsearFacturaSriRecibida(
      construirFacturaXml({ omitirDetalles: true }),
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.factura.detalles).toHaveLength(0);
    expect(resultado.factura.advertencia).toBeTruthy();
  });

  it('parsea una factura con varias líneas que corresponderán a distintas categorías', () => {
    const resultado = parsearFacturaSriRecibida(
      construirFacturaXml({
        totalSinImpuestos: '30.00',
        importeTotal: '30.00',
        totalConImpuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            baseImponible: '30.00',
            valor: '0.00',
          },
        ],
        detalles: [
          {
            descripcion: 'Arroz',
            cantidad: '2.000000',
            precioUnitario: '5.000000',
            precioTotalSinImpuesto: '10.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '0',
                tarifa: '0.00',
                baseImponible: '10.00',
                valor: '0.00',
              },
            ],
          },
          {
            descripcion: 'Detergente',
            cantidad: '1.000000',
            precioUnitario: '15.000000',
            precioTotalSinImpuesto: '15.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '0',
                tarifa: '0.00',
                baseImponible: '15.00',
                valor: '0.00',
              },
            ],
          },
          {
            descripcion: 'Otros',
            cantidad: '1.000000',
            precioUnitario: '5.000000',
            precioTotalSinImpuesto: '5.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '0',
                tarifa: '0.00',
                baseImponible: '5.00',
                valor: '0.00',
              },
            ],
          },
        ],
      }),
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.factura.detalles.map((d) => d.descripcion)).toEqual([
      'Arroz',
      'Detergente',
      'Otros',
    ]);
  });

  it('parsea una factura con descuento en una línea', () => {
    const resultado = parsearFacturaSriRecibida(
      construirFacturaXml({
        detalles: [
          {
            descripcion: 'Servicio con descuento',
            cantidad: '1.000000',
            precioUnitario: '100.000000',
            descuento: '10.00',
            precioTotalSinImpuesto: '90.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '4',
                tarifa: '15.00',
                baseImponible: '90.00',
                valor: '13.50',
              },
            ],
          },
        ],
      }),
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.factura.detalles[0].descuento).toBe('10.00');
  });

  it('parsea una factura con distintas tarifas de impuesto (0%, 5%, 12%, 15%) por línea', () => {
    const resultado = parsearFacturaSriRecibida(
      construirFacturaXml({
        totalSinImpuestos: '400.00',
        importeTotal: '454.50',
        totalConImpuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            baseImponible: '100.00',
            valor: '0.00',
          },
          {
            codigo: '2',
            codigoPorcentaje: '5',
            baseImponible: '100.00',
            valor: '5.00',
          },
          {
            codigo: '2',
            codigoPorcentaje: '2',
            baseImponible: '100.00',
            valor: '12.00',
          },
          {
            codigo: '2',
            codigoPorcentaje: '4',
            baseImponible: '100.00',
            valor: '15.00',
          },
        ],
        detalles: [
          {
            descripcion: 'Producto tarifa 0%',
            cantidad: '1.000000',
            precioUnitario: '100.000000',
            precioTotalSinImpuesto: '100.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '0',
                tarifa: '0.00',
                baseImponible: '100.00',
                valor: '0.00',
              },
            ],
          },
          {
            descripcion: 'Producto tarifa 5%',
            cantidad: '1.000000',
            precioUnitario: '100.000000',
            precioTotalSinImpuesto: '100.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '5',
                tarifa: '5.00',
                baseImponible: '100.00',
                valor: '5.00',
              },
            ],
          },
          {
            descripcion: 'Producto tarifa 12%',
            cantidad: '1.000000',
            precioUnitario: '100.000000',
            precioTotalSinImpuesto: '100.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '2',
                tarifa: '12.00',
                baseImponible: '100.00',
                valor: '12.00',
              },
            ],
          },
          {
            descripcion: 'Producto tarifa 15%',
            cantidad: '1.000000',
            precioUnitario: '100.000000',
            precioTotalSinImpuesto: '100.00',
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '4',
                tarifa: '15.00',
                baseImponible: '100.00',
                valor: '15.00',
              },
            ],
          },
        ],
      }),
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const tarifas = resultado.factura.detalles.map(
      (d) => d.impuestos[0]?.codigoPorcentaje,
    );
    expect(tarifas).toEqual(['0', '5', '2', '4']);
    // 0 + 5 + 12 + 15 = 32.00 de IVA total.
    expect(resultado.factura.iva).toBe('32.00');
  });

  it('rechaza un comprobante que no es codDoc 01 (por ejemplo una guía de remisión)', () => {
    const xml = construirFacturaXml({}).replace(
      '<codDoc>01</codDoc>',
      '<codDoc>06</codDoc>',
    );
    const resultado = parsearFacturaSriRecibida(xml);

    expect(resultado.ok).toBe(false);
  });

  it('desenvuelve el XML cuando viene dentro de un CDATA de autorización', () => {
    const xmlInterno = construirFacturaXml({ claveAcceso: '5'.repeat(49) });
    const xmlEnvuelto = `<autorizacion><estado>AUTORIZADO</estado><comprobante><![CDATA[${xmlInterno}]]></comprobante></autorizacion>`;

    const resultado = parsearFacturaSriRecibida(xmlEnvuelto);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.factura.claveAcceso).toBe('5'.repeat(49));
  });
});
