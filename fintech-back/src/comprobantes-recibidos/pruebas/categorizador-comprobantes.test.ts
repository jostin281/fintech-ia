import { describe, expect, it } from 'vitest';

import {
  clasificarDescripcion,
  normalizarTexto,
  ordenarReglasPorPrioridad,
  type ReglaCategorizacionCandidata,
} from '../utilidades/categorizador-comprobantes';

describe('normalizarTexto', () => {
  it('recorta, colapsa espacios y quita acentos en mayúsculas', () => {
    expect(normalizarTexto('  Gasolina   Extra  ')).toBe('GASOLINA EXTRA');
    expect(normalizarTexto('Alimentación')).toBe('ALIMENTACION');
  });
});

describe('clasificarDescripcion', () => {
  const reglas: ReglaCategorizacionCandidata[] = [
    {
      id: 1,
      usuarioId: null,
      palabraClave: 'arroz',
      prioridad: 0,
      categoriaId: 10,
    },
    {
      id: 2,
      usuarioId: null,
      palabraClave: 'gasolina',
      prioridad: 0,
      categoriaId: 20,
    },
    {
      id: 3,
      usuarioId: 5,
      palabraClave: 'arroz',
      prioridad: 10,
      categoriaId: 99,
    },
  ];

  it('clasifica "Arroz" en Alimentación (regla global) cuando no hay reglas personales', () => {
    const resultado = clasificarDescripcion(
      'Arroz',
      ordenarReglasPorPrioridad(
        reglas.filter((r) => r.usuarioId === null),
        1,
      ),
    );

    expect(resultado).toEqual({ categoriaId: 10, reglaId: 1 });
  });

  it('prefiere la regla personal del usuario sobre la global para la misma palabra', () => {
    const resultado = clasificarDescripcion(
      'Arroz integral 1kg',
      ordenarReglasPorPrioridad(reglas, 5),
    );

    expect(resultado).toEqual({ categoriaId: 99, reglaId: 3 });
  });

  it('devuelve null cuando ninguna regla coincide', () => {
    const resultado = clasificarDescripcion(
      'Servicio de streaming',
      ordenarReglasPorPrioridad(reglas, 1),
    );

    expect(resultado).toBeNull();
  });

  it('no distingue mayúsculas/acentos al comparar', () => {
    const resultado = clasificarDescripcion(
      'GASOLINA extra',
      ordenarReglasPorPrioridad(reglas, 1),
    );

    expect(resultado).toEqual({ categoriaId: 20, reglaId: 2 });
  });
});
