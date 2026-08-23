import { describe, expect, it } from 'vitest';

import { calcularTotalesFactura } from '../utilidades/calculadora-factura';
import {
  calcularImpuestoPersonaNaturalGeneral,
  calcularImpuestoRimpe,
  calcularRebajaGastosPersonales,
  obtenerNumeroCanastas,
} from '../utilidades/calculadora-impuesto-renta';
import {
  cifrarCertificado,
  descifrarCertificado,
} from '../utilidades/cifrado-credencial';
import {
  convertirFechaIsoEcuador,
  formatearFechaSri,
  obtenerRangoAnualEcuador,
} from '../utilidades/fecha-ecuador';
import {
  esCedulaEcuadorValida,
  esRucEcuadorValido,
} from '../utilidades/identificacion-ecuador';

describe('cálculo de facturas', () => {
  it('calcula base, descuento, IVA y total sin usar punto flotante', () => {
    const resultado = calcularTotalesFactura([
      {
        productoServicioId: 1,
        codigoPrincipal: 'SERV-001',
        descripcion: 'Servicio de prueba',
        precioUnitario: '100.00',
        tarifaIva: 'QUINCE',
        cantidad: '2.00',
        descuento: '10.00',
      },
    ]);

    expect(resultado.subtotalQuince).toBe('190.00');
    expect(resultado.totalDescuento).toBe('10.00');
    expect(resultado.iva).toBe('28.50');
    expect(resultado.importeTotal).toBe('218.50');
  });

  it('separa correctamente productos con IVA cero', () => {
    const resultado = calcularTotalesFactura([
      {
        productoServicioId: 2,
        codigoPrincipal: 'PROD-0',
        descripcion: 'Producto tarifa cero',
        precioUnitario: '12.50',
        tarifaIva: 'CERO',
        cantidad: '2',
      },
    ]);

    expect(resultado.subtotalCero).toBe('25.00');
    expect(resultado.iva).toBe('0.00');
    expect(resultado.importeTotal).toBe('25.00');
  });

  it('rechaza un descuento superior al valor bruto', () => {
    expect(() =>
      calcularTotalesFactura([
        {
          productoServicioId: 1,
          codigoPrincipal: 'SERV-001',
          descripcion: 'Servicio',
          precioUnitario: '10.00',
          tarifaIva: 'QUINCE',
          cantidad: '1',
          descuento: '10.01',
        },
      ]),
    ).toThrow(/descuento/i);
  });
});

describe('estimación de Impuesto a la Renta', () => {
  it('aplica la tabla oficial 2026 a una persona natural', () => {
    const resultado = calcularImpuestoPersonaNaturalGeneral(2026, '20000');

    expect(resultado.fraccionBasica).toBe('15549.00');
    expect(resultado.porcentajeExcedente).toBe('10.00');
    expect(resultado.impuestoCausado).toBe('612.10');
  });

  it('calcula la rebaja del 18 % con el límite de cargas familiares', () => {
    const resultado = calcularRebajaGastosPersonales('10000', '800', 1, false);

    expect(resultado.numeroCanastas).toBe(9);
    expect(resultado.limiteGastosPersonales).toBe('7200.00');
    expect(resultado.rebaja).toBe('1296.00');
  });

  it('usa cien canastas para el caso especial de enfermedad catastrófica', () => {
    expect(obtenerNumeroCanastas(0, true)).toBe(100);
  });

  it('calcula el valor progresivo RIMPE al límite de USD 50.000', () => {
    expect(calcularImpuestoRimpe(2026, '50000')).toBe('360.00');
  });

  it('usa la fracción básica publicada al iniciar el último tramo 2026', () => {
    const resultado = calcularImpuestoPersonaNaturalGeneral(2026, '109956');

    expect(resultado.fraccionBasica).toBe('109956.00');
    expect(resultado.impuestoCausado).toBe('24572.00');
  });

  it('respeta la fracción básica oficial RIMPE superior a USD 200.000', () => {
    expect(calcularImpuestoRimpe(2026, '200000.01')).toBe('2797.52');
  });

  it('rechaza calcular RIMPE con un ejercicio no verificado', () => {
    expect(() => calcularImpuestoRimpe(2027, '50000')).toThrow(/2027/);
  });
});

describe('identificaciones ecuatorianas', () => {
  it('valida dígitos verificadores de cédula y de los tres tipos de RUC', () => {
    expect(esCedulaEcuadorValida('1755555552')).toBe(true);
    expect(esCedulaEcuadorValida('1755555553')).toBe(false);
    expect(esRucEcuadorValido('1755555552001')).toBe(true);
    expect(esRucEcuadorValido('1799999990001')).toBe(true);
    expect(esRucEcuadorValido('1760013210001')).toBe(true);
  });
});

describe('protección de la firma electrónica', () => {
  it('cifra y descifra una credencial sin perder información', () => {
    const certificado = {
      certPem: 'CERTIFICADO-DE-PRUEBA',
      privateKeyPem: 'CLAVE-PRIVADA-DE-PRUEBA',
      extraCerts: ['CERTIFICADO-INTERMEDIO'],
    };
    const clave = Buffer.alloc(32, 7);
    const cifrado = cifrarCertificado(certificado, clave);
    const descifrado = descifrarCertificado(
      cifrado.contenido,
      cifrado.vectorInicializacion,
      cifrado.etiquetaAutenticacion,
      clave,
    );

    expect(descifrado).toEqual(certificado);
    expect(Buffer.from(cifrado.contenido).toString('utf8')).not.toContain(
      'CLAVE-PRIVADA-DE-PRUEBA',
    );
  });
});

describe('fechas tributarias de Ecuador', () => {
  it('convierte la medianoche ecuatoriana a 05:00 UTC', () => {
    const fecha = convertirFechaIsoEcuador('2026-08-13');

    expect(fecha.toISOString()).toBe('2026-08-13T05:00:00.000Z');
    expect(formatearFechaSri(fecha)).toBe('13/08/2026');
  });

  it('crea un rango anual sin perder movimientos del 31 de diciembre', () => {
    const rango = obtenerRangoAnualEcuador(2026);

    expect(rango.fechaDesde.toISOString()).toBe('2026-01-01T05:00:00.000Z');
    expect(rango.fechaHastaExclusiva.toISOString()).toBe(
      '2027-01-01T05:00:00.000Z',
    );
  });
});
