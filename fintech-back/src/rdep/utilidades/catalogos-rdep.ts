/**
 * Catálogos de valores fijos ("tablas") del Anexo RDEP / Formulario 107,
 * tomados de la Ficha Técnica oficial del SRI. Se centralizan aquí (en vez
 * de escribir los mismos textos en el frontend) para que exista una única
 * fuente de verdad, expuesta por GET /api/rdep/catalogos.
 */

export interface OpcionCatalogoRdep {
  valor: string;
  etiqueta: string;
}

export const CATALOGO_TIPO_IDENTIFICACION_TRABAJADOR: OpcionCatalogoRdep[] = [
  { valor: 'CEDULA', etiqueta: 'C — Cédula' },
  { valor: 'IDENTIFICACION_EXTERIOR', etiqueta: 'E — Identificación tributaria del exterior' },
  { valor: 'PASAPORTE', etiqueta: 'P — Pasaporte' },
];

export const CATALOGO_RESIDENCIA_TRABAJADOR: OpcionCatalogoRdep[] = [
  { valor: 'LOCAL', etiqueta: '01 — Residente local' },
  { valor: 'EXTERIOR', etiqueta: '02 — Residente del exterior' },
];

export const CATALOGO_CONDICION_DISCAPACIDAD: OpcionCatalogoRdep[] = [
  { valor: 'NO_APLICA', etiqueta: '01 — No aplica' },
  { valor: 'CON_DISCAPACIDAD', etiqueta: '02 — Trabajador con discapacidad' },
  { valor: 'SUSTITUTO', etiqueta: '03 — Sustituto de persona con discapacidad' },
];

export const CATALOGO_CONVENIO_DOBLE_IMPOSICION: OpcionCatalogoRdep[] = [
  { valor: 'NO_APLICA', etiqueta: 'NA — No aplica' },
  { valor: 'NO', etiqueta: 'NO — Sin convenio' },
  { valor: 'SI', etiqueta: 'SI — Con convenio' },
];

export const CATALOGO_SISTEMA_SALARIO_NETO: OpcionCatalogoRdep[] = [
  { valor: 'SIN_SISTEMA', etiqueta: '1 — Sin sistema de salario neto' },
  { valor: 'CON_SISTEMA', etiqueta: '2 — Con sistema de salario neto' },
];

export const CATALOGO_TIPO_EMPLEADOR: OpcionCatalogoRdep[] = [
  { valor: 'PRIVADO_MIXTO', etiqueta: 'Privado o mixto' },
  { valor: 'PUBLICO', etiqueta: 'Público / IFI pública' },
];

export const CATALOGO_ENTE_SEGURIDAD_SOCIAL: OpcionCatalogoRdep[] = [
  { valor: 'IESS', etiqueta: 'IESS' },
  { valor: 'ISSFA_ISSPOL', etiqueta: 'ISSFA / ISSPOL' },
];

export const CATALOGO_CARGAS_FAMILIARES: OpcionCatalogoRdep[] = [
  { valor: '0', etiqueta: '0 cargas' },
  { valor: '1', etiqueta: '1 carga' },
  { valor: '2', etiqueta: '2 cargas' },
  { valor: '3', etiqueta: '3 cargas' },
  { valor: '4', etiqueta: '4 cargas' },
  { valor: '5', etiqueta: '5 o más cargas' },
];

/**
 * Compatibilidad obligatoria entre tipo de empleador y ente de seguridad
 * social (Ficha Técnica RDEP): un empleador PRIVADO_MIXTO solo puede
 * reportar aportes al IESS; uno PUBLICO puede reportar IESS o ISSFA/ISSPOL.
 */
export function esCompatibleEmpleadorConEnteSeguridadSocial(
  tipoEmpleador: 'PRIVADO_MIXTO' | 'PUBLICO',
  ente: 'IESS' | 'ISSFA_ISSPOL',
): boolean {
  if (tipoEmpleador === 'PRIVADO_MIXTO') {
    return ente === 'IESS';
  }
  return true;
}
