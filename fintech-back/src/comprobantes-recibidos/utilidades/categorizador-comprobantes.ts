/**
 * Motor de categorización automática por palabra clave (sección 27-28 del
 * alcance funcional: "Arroz → Alimentación", "Gasolina → Transporte", etc.).
 * Es una función pura: no toca la base de datos, solo recibe las reglas ya
 * cargadas y decide cuál aplica.
 */

export interface ReglaCategorizacionCandidata {
  id: number;
  usuarioId: number | null;
  palabraClave: string;
  prioridad: number;
  categoriaId: number;
}

export interface ClasificacionEncontrada {
  categoriaId: number;
  reglaId: number;
}

/**
 * Normaliza un texto para comparación: recorta espacios, colapsa espacios
 * repetidos y pasa a mayúsculas sin distinguir acentos. Mismo criterio de
 * limpieza que ya usa CrearCategoriaDto con @Transform.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Ordena las reglas: personales (usuarioId propio) antes que globales,
 * luego por prioridad descendente, y por id ascendente como desempate
 * estable. El llamador debe pasar solo reglas activas.
 */
export function ordenarReglasPorPrioridad(
  reglas: ReglaCategorizacionCandidata[],
  usuarioId: number,
): ReglaCategorizacionCandidata[] {
  return [...reglas].sort((a, b) => {
    const aPersonal = a.usuarioId === usuarioId ? 1 : 0;
    const bPersonal = b.usuarioId === usuarioId ? 1 : 0;
    if (aPersonal !== bPersonal) return bPersonal - aPersonal;
    if (a.prioridad !== b.prioridad) return b.prioridad - a.prioridad;
    return a.id - b.id;
  });
}

/**
 * Busca la primera regla (ya ordenada por el llamador con
 * ordenarReglasPorPrioridad) cuya palabra clave aparezca dentro de la
 * descripción normalizada. Devuelve null si ninguna regla coincide, lo que
 * deja la línea sin categorizar hasta una corrección manual.
 */
export function clasificarDescripcion(
  descripcion: string,
  reglasOrdenadas: ReglaCategorizacionCandidata[],
): ClasificacionEncontrada | null {
  const descripcionNormalizada = normalizarTexto(descripcion);
  if (!descripcionNormalizada) return null;

  for (const regla of reglasOrdenadas) {
    const palabraClaveNormalizada = normalizarTexto(regla.palabraClave);
    if (
      palabraClaveNormalizada &&
      descripcionNormalizada.includes(palabraClaveNormalizada)
    ) {
      return { categoriaId: regla.categoriaId, reglaId: regla.id };
    }
  }

  return null;
}
