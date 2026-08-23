import { BadRequestException } from '@nestjs/common';

const HORA_UTC_MEDIANOCHE_ECUADOR = 5;
const DESFASE_ECUADOR_HORAS = -5;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;

export function obtenerFechaActualEcuador(): {
  anio: number;
  mes: number;
  dia: number;
  iso: string;
} {
  const fecha = new Date(
    Date.now() + DESFASE_ECUADOR_HORAS * MILISEGUNDOS_POR_HORA,
  );
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth() + 1;
  const dia = fecha.getUTCDate();

  return {
    anio,
    mes,
    dia,
    iso: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
  };
}

export function convertirFechaIsoEcuador(fechaIso: string): Date {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);

  if (!coincidencia) {
    throw new BadRequestException('La fecha debe usar el formato YYYY-MM-DD');
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(
    Date.UTC(anio, mes - 1, dia, HORA_UTC_MEDIANOCHE_ECUADOR),
  );

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() + 1 !== mes ||
    fecha.getUTCDate() !== dia
  ) {
    throw new BadRequestException('La fecha enviada no existe');
  }

  return fecha;
}

export function obtenerRangoAnualEcuador(anio: number): {
  fechaDesde: Date;
  fechaHastaExclusiva: Date;
} {
  return {
    fechaDesde: new Date(Date.UTC(anio, 0, 1, HORA_UTC_MEDIANOCHE_ECUADOR)),
    fechaHastaExclusiva: new Date(
      Date.UTC(anio + 1, 0, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    ),
  };
}

/** Rango [1 del mes, 1 del mes siguiente) en hora Ecuador, para agregados mensuales (IVA). */
export function obtenerRangoMensualEcuador(
  anio: number,
  mes: number,
): {
  fechaDesde: Date;
  fechaHastaExclusiva: Date;
} {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new BadRequestException('El mes debe ser un número entre 1 y 12');
  }

  const mesIndiceCero = mes - 1;

  return {
    fechaDesde: new Date(Date.UTC(anio, mesIndiceCero, 1, HORA_UTC_MEDIANOCHE_ECUADOR)),
    fechaHastaExclusiva: new Date(
      Date.UTC(anio, mesIndiceCero + 1, 1, HORA_UTC_MEDIANOCHE_ECUADOR),
    ),
  };
}

export function formatearFechaSri(fecha: Date): string {
  const fechaEcuador = new Date(
    fecha.getTime() + DESFASE_ECUADOR_HORAS * MILISEGUNDOS_POR_HORA,
  );

  return [
    String(fechaEcuador.getUTCDate()).padStart(2, '0'),
    String(fechaEcuador.getUTCMonth() + 1).padStart(2, '0'),
    String(fechaEcuador.getUTCFullYear()),
  ].join('/');
}
