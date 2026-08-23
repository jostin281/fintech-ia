/**
 * Alcance de una ReglaCategorizacion tal como lo recibe la API. No es un
 * enum de Prisma: en la base de datos el alcance se representa con
 * usuarioId nulo (GLOBAL) o con valor (PERSONAL) sobre el mismo modelo.
 */
export enum AlcanceRegla {
  GLOBAL = 'GLOBAL',
  PERSONAL = 'PERSONAL',
}
