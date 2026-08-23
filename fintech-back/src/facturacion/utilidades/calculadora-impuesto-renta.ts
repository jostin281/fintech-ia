import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

interface TramoImpuestoRenta {
  desde: string;
  hasta?: string;
  impuestoFraccionBasica: string;
  porcentajeExcedente: string;
}

// Tablas oficiales para personas naturales del régimen general.
const TABLAS_IMPUESTO_RENTA: Record<number, TramoImpuestoRenta[]> = {
  2025: [
    {
      desde: '0',
      hasta: '12081',
      impuestoFraccionBasica: '0',
      porcentajeExcedente: '0',
    },
    {
      desde: '12081',
      hasta: '15387',
      impuestoFraccionBasica: '0',
      porcentajeExcedente: '5',
    },
    {
      desde: '15387',
      hasta: '19978',
      impuestoFraccionBasica: '165',
      porcentajeExcedente: '10',
    },
    {
      desde: '19978',
      hasta: '26422',
      impuestoFraccionBasica: '624',
      porcentajeExcedente: '12',
    },
    {
      desde: '26422',
      hasta: '34770',
      impuestoFraccionBasica: '1398',
      porcentajeExcedente: '15',
    },
    {
      desde: '34770',
      hasta: '46089',
      impuestoFraccionBasica: '2650',
      porcentajeExcedente: '20',
    },
    {
      desde: '46089',
      hasta: '61359',
      impuestoFraccionBasica: '4914',
      porcentajeExcedente: '25',
    },
    {
      desde: '61359',
      hasta: '81817',
      impuestoFraccionBasica: '8731',
      porcentajeExcedente: '30',
    },
    {
      desde: '81817',
      hasta: '108810',
      impuestoFraccionBasica: '14869',
      porcentajeExcedente: '35',
    },
    {
      desde: '108810',
      impuestoFraccionBasica: '24316',
      porcentajeExcedente: '37',
    },
  ],
  2026: [
    {
      desde: '0',
      hasta: '12208',
      impuestoFraccionBasica: '0',
      porcentajeExcedente: '0',
    },
    {
      desde: '12208',
      hasta: '15549',
      impuestoFraccionBasica: '0',
      porcentajeExcedente: '5',
    },
    {
      desde: '15549',
      hasta: '20188',
      impuestoFraccionBasica: '167',
      porcentajeExcedente: '10',
    },
    {
      desde: '20188',
      hasta: '26700',
      impuestoFraccionBasica: '631',
      porcentajeExcedente: '12',
    },
    {
      desde: '26700',
      hasta: '35136',
      impuestoFraccionBasica: '1412',
      porcentajeExcedente: '15',
    },
    {
      desde: '35136',
      hasta: '46575',
      impuestoFraccionBasica: '2678',
      porcentajeExcedente: '20',
    },
    {
      desde: '46575',
      hasta: '62005',
      impuestoFraccionBasica: '4965',
      porcentajeExcedente: '25',
    },
    {
      desde: '62005',
      hasta: '82679',
      impuestoFraccionBasica: '8823',
      porcentajeExcedente: '30',
    },
    {
      desde: '82679',
      hasta: '109956',
      impuestoFraccionBasica: '15025',
      porcentajeExcedente: '35',
    },
    {
      desde: '109956',
      impuestoFraccionBasica: '24572',
      porcentajeExcedente: '37',
    },
  ],
};

export interface ResultadoImpuestoFraccionado {
  baseImponible: string;
  fraccionBasica: string;
  impuestoFraccionBasica: string;
  porcentajeExcedente: string;
  impuestoCausado: string;
}

export function calcularImpuestoPersonaNaturalGeneral(
  anio: number,
  baseImponibleEntrada: Decimal.Value,
): ResultadoImpuestoFraccionado {
  const tabla = TABLAS_IMPUESTO_RENTA[anio];

  if (!tabla) {
    throw new BadRequestException(
      `No existe una tabla verificada de Impuesto a la Renta para el año ${anio}`,
    );
  }

  const baseImponible = Decimal.max(new Decimal(baseImponibleEntrada), 0);
  const tramo = tabla.find((item) => {
    const desde = new Decimal(item.desde);
    const cumpleDesde = baseImponible.greaterThanOrEqualTo(desde);
    // El límite superior es exclusivo: al llegar a la siguiente fracción se
    // debe usar el impuesto fijo publicado para ese nuevo tramo.
    const cumpleHasta =
      item.hasta === undefined || baseImponible.lessThan(item.hasta);
    return cumpleDesde && cumpleHasta;
  });

  if (!tramo) {
    throw new BadRequestException(
      'No se pudo ubicar la base imponible en la tabla',
    );
  }

  const fraccionBasica = new Decimal(tramo.desde);
  const impuestoFraccionBasica = new Decimal(tramo.impuestoFraccionBasica);
  const porcentajeExcedente = new Decimal(tramo.porcentajeExcedente);
  const impuestoExcedente = baseImponible
    .minus(fraccionBasica)
    .times(porcentajeExcedente)
    .dividedBy(100);

  const impuestoCausado = impuestoFraccionBasica
    .plus(impuestoExcedente)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    baseImponible: baseImponible.toFixed(2),
    fraccionBasica: fraccionBasica.toFixed(2),
    impuestoFraccionBasica: impuestoFraccionBasica.toFixed(2),
    porcentajeExcedente: porcentajeExcedente.toFixed(2),
    impuestoCausado: impuestoCausado.toFixed(2),
  };
}

export function obtenerNumeroCanastas(
  cargasFamiliares: number,
  enfermedadCatastrofica: boolean,
): number {
  if (enfermedadCatastrofica) {
    return 100;
  }

  if (cargasFamiliares <= 0) return 7;
  if (cargasFamiliares === 1) return 9;
  if (cargasFamiliares === 2) return 11;
  if (cargasFamiliares === 3) return 14;
  if (cargasFamiliares === 4) return 17;
  return 20;
}

export function calcularRebajaGastosPersonales(
  gastosPersonales: Decimal.Value,
  canastaBasicaMensual: Decimal.Value,
  cargasFamiliares: number,
  enfermedadCatastrofica: boolean,
): {
  numeroCanastas: number;
  limiteGastosPersonales: string;
  baseAplicada: string;
  rebaja: string;
} {
  const numeroCanastas = obtenerNumeroCanastas(
    cargasFamiliares,
    enfermedadCatastrofica,
  );
  const limite = new Decimal(canastaBasicaMensual).times(numeroCanastas);
  const baseAplicada = Decimal.min(new Decimal(gastosPersonales), limite);
  const rebaja = baseAplicada
    .times(18)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    numeroCanastas,
    limiteGastosPersonales: limite.toFixed(2),
    baseAplicada: baseAplicada.toFixed(2),
    rebaja: rebaja.toFixed(2),
  };
}

/**
 * Tabla progresiva RIMPE vigente desde el ejercicio 2024. Los años admitidos
 * se limitan deliberadamente a los que fueron verificados al preparar esta
 * versión; un ejercicio posterior obliga a revisar la normativa primero.
 */
export function calcularImpuestoRimpe(
  anio: number,
  ingresosBrutosEntrada: Decimal.Value,
): string {
  if (![2024, 2025, 2026].includes(anio)) {
    throw new BadRequestException(
      `No existe una tabla RIMPE verificada en el módulo para el año ${anio}`,
    );
  }

  const ingresos = Decimal.max(new Decimal(ingresosBrutosEntrada), 0);

  if (ingresos.lessThanOrEqualTo(2500)) return '0.00';
  if (ingresos.lessThanOrEqualTo(5000)) return '5.00';
  if (ingresos.lessThanOrEqualTo(10000)) return '15.00';
  if (ingresos.lessThanOrEqualTo(15000)) return '35.00';
  if (ingresos.lessThanOrEqualTo(20000)) return '60.00';

  let impuesto: Decimal;

  if (ingresos.lessThanOrEqualTo(50000)) {
    impuesto = new Decimal(60).plus(ingresos.minus(20000).times('0.01'));
  } else if (ingresos.lessThanOrEqualTo(75000)) {
    impuesto = new Decimal(360).plus(ingresos.minus(50000).times('0.0125'));
  } else if (ingresos.lessThanOrEqualTo(100000)) {
    impuesto = new Decimal('672.50').plus(ingresos.minus(75000).times('0.015'));
  } else if (ingresos.lessThanOrEqualTo(200000)) {
    impuesto = new Decimal('1047.50').plus(
      ingresos.minus(100000).times('0.0175'),
    );
  } else if (ingresos.lessThanOrEqualTo(300000)) {
    impuesto = new Decimal('2797.52').plus(
      ingresos.minus(200000).times('0.02'),
    );
  } else {
    throw new BadRequestException(
      'Los ingresos superan USD 300.000 y requieren revisar la permanencia en RIMPE',
    );
  }

  return impuesto.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
