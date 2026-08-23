/**
 * Catálogo de códigos de país usado por el Anexo RDEP del SRI ("País de
 * residencia del trabajador"). Los códigos vienen de la Ficha Técnica RDEP
 * publicada en sri.gob.ec — no son códigos inventados por FINTECH.
 *
 * IMPORTANTE: esta es una lista PARCIAL (los países más frecuentes en cada
 * región) y no la tabla completa de ~190 países que publica el SRI. Si el
 * trabajador reside en un país que no aparece aquí, no bloqueamos el
 * guardado por catálogo (ver rdep-validacion.service.ts): solo exigimos que
 * el código tenga el formato oficial (3 dígitos numéricos) y advertimos que
 * debe verificarse el código exacto en la tabla de países vigente de
 * sri.gob.ec antes de generar el anexo definitivo.
 *
 * Se expone también por HTTP (GET /api/rdep/catalogos) para que el
 * frontend pueda ofrecer un selector en vez de un campo de texto libre.
 */
export interface PaisCatalogoRdep {
  codigo: string;
  nombre: string;
}

export const CATALOGO_PAISES_RDEP: PaisCatalogoRdep[] = [
  { codigo: '593', nombre: 'Ecuador' },
  { codigo: '101', nombre: 'Argentina' },
  { codigo: '102', nombre: 'Bolivia' },
  { codigo: '103', nombre: 'Brasil' },
  { codigo: '104', nombre: 'Canadá' },
  { codigo: '105', nombre: 'Colombia' },
  { codigo: '106', nombre: 'Costa Rica' },
  { codigo: '107', nombre: 'Cuba' },
  { codigo: '108', nombre: 'Chile' },
  { codigo: '110', nombre: 'Estados Unidos' },
  { codigo: '111', nombre: 'Guatemala' },
  { codigo: '112', nombre: 'Haití' },
  { codigo: '113', nombre: 'Honduras' },
  { codigo: '114', nombre: 'Jamaica' },
  { codigo: '116', nombre: 'México' },
  { codigo: '117', nombre: 'Nicaragua' },
  { codigo: '118', nombre: 'Panamá' },
  { codigo: '119', nombre: 'Paraguay' },
  { codigo: '120', nombre: 'Perú' },
  { codigo: '121', nombre: 'Puerto Rico' },
  { codigo: '122', nombre: 'República Dominicana' },
  { codigo: '123', nombre: 'El Salvador' },
  { codigo: '125', nombre: 'Uruguay' },
  { codigo: '126', nombre: 'Venezuela' },
  { codigo: '202', nombre: 'Alemania' },
  { codigo: '203', nombre: 'Austria' },
  { codigo: '204', nombre: 'Bélgica' },
  { codigo: '208', nombre: 'Dinamarca' },
  { codigo: '209', nombre: 'España' },
  { codigo: '211', nombre: 'Francia' },
  { codigo: '212', nombre: 'Finlandia' },
  { codigo: '213', nombre: 'Reino Unido' },
  { codigo: '214', nombre: 'Grecia' },
  { codigo: '215', nombre: 'Países Bajos' },
  { codigo: '217', nombre: 'Irlanda' },
  { codigo: '219', nombre: 'Italia' },
  { codigo: '222', nombre: 'Noruega' },
  { codigo: '223', nombre: 'Polonia' },
  { codigo: '224', nombre: 'Portugal' },
  { codigo: '226', nombre: 'Suecia' },
  { codigo: '227', nombre: 'Suiza' },
  { codigo: '230', nombre: 'Rusia' },
  { codigo: '309', nombre: 'India' },
  { codigo: '310', nombre: 'Indonesia' },
  { codigo: '314', nombre: 'Japón' },
  { codigo: '319', nombre: 'Malasia' },
  { codigo: '330', nombre: 'Corea del Sur' },
  { codigo: '331', nombre: 'China' },
  { codigo: '333', nombre: 'Emiratos Árabes Unidos' },
  { codigo: '338', nombre: 'Singapur' },
  { codigo: '354', nombre: 'Hong Kong' },
  { codigo: '415', nombre: 'Marruecos' },
  { codigo: '417', nombre: 'Nigeria' },
  { codigo: '422', nombre: 'Sudáfrica' },
  { codigo: '434', nombre: 'Egipto' },
  { codigo: '501', nombre: 'Australia' },
  { codigo: '503', nombre: 'Nueva Zelanda' },
];

export function existeCodigoPaisRdep(codigo: string): boolean {
  return CATALOGO_PAISES_RDEP.some((pais) => pais.codigo === codigo);
}
