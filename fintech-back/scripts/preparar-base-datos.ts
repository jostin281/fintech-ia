// Script de preparación inicial de la base de datos.
//
// Requisito previo: el contenedor de PostgreSQL debe estar corriendo
// (ver docker-compose.yml en esta carpeta):
//
//   docker compose up -d
//
// Uso (una sola vez, o cada vez que se agreguen migraciones nuevas):
//
//   npm run db:preparar
//
// Qué hace:
//   1. Aplica todas las migraciones de prisma/migrations (equivalente a
//      "npx prisma migrate deploy", pero sin pedir confirmación).
//   2. Genera el cliente de Prisma (src/generated/prisma) a partir del
//      schema; sin este paso el backend no compila.
//   3. Ejecuta prisma/seed.ts para crear las categorías por defecto y
//      convertir en ADMINISTRADOR al primer usuario que se registre.

import 'dotenv/config';
import { execSync } from 'child_process';

function main() {
  console.log('[db-preparar] Aplicando migraciones (prisma migrate deploy)…');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('[db-preparar] Generando el cliente de Prisma…');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('[db-preparar] Sembrando datos iniciales (categorías, admin)…');
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

  console.log(
    '[db-preparar] Listo. Ya puedes ejecutar "npm run start:dev" para iniciar el backend.',
  );
}

try {
  main();
} catch (error) {
  console.error('[db-preparar] Falló la preparación de la base de datos:', error);
  process.exitCode = 1;
}
