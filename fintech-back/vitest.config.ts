import { defineConfig } from 'vitest/config';

// Tests de lógica pura (cálculos SRI, impuestos, cifrado, fechas, etc.).
// Se identifican con el sufijo ".test.ts" para no chocar con los tests de
// integración de NestJS (sufijo ".spec.ts"), que corren con Jest porque
// dependen del contenedor de inyección de dependencias de Nest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/generated'],
  },
});
