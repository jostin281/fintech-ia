// Script de siembra (seed) de datos iniciales.
//
// Los endpoints POST /api/categorias y PATCH /api/categorias/:id/estado
// exigen el rol ADMINISTRADOR (ver categorias.controller.ts), y el registro
// público (POST /api/auth/registro) siempre crea usuarios con rol USUARIO.
// Sin este script, una base de datos nueva quedaría sin ninguna categoría
// disponible y ningún usuario podría registrar movimientos, presupuestos
// ni facturas (todos requieren una categoriaId válida).
//
// Ejecución manual:  npx prisma db seed
// Se ejecuta automáticamente después de "npx prisma migrate dev".
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import type { TipoMovimiento } from '../src/generated/prisma/enums';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta configurar DATABASE_URL en el archivo .env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface CategoriaSemilla {
  nombre: string;
  tipo: TipoMovimiento;
}

// Catálogo base de categorías financieras. Las de tipo GASTO cubren además
// los seis grupos de gastos personales deducibles del SRI (vivienda, salud,
// educación/arte/cultura, alimentación, vestimenta y turismo) para que el
// módulo de facturación pueda clasificarlas tributariamente sin fricción.
const CATEGORIAS_INGRESO: CategoriaSemilla[] = [
  { nombre: 'Salario', tipo: 'INGRESO' },
  { nombre: 'Ventas y Facturación', tipo: 'INGRESO' },
  { nombre: 'Servicios Profesionales', tipo: 'INGRESO' },
  { nombre: 'Inversiones', tipo: 'INGRESO' },
  { nombre: 'Otros Ingresos', tipo: 'INGRESO' },
];

const CATEGORIAS_GASTO: CategoriaSemilla[] = [
  { nombre: 'Alimentación', tipo: 'GASTO' },
  { nombre: 'Vivienda', tipo: 'GASTO' },
  { nombre: 'Salud', tipo: 'GASTO' },
  { nombre: 'Educación Arte y Cultura', tipo: 'GASTO' },
  { nombre: 'Vestimenta', tipo: 'GASTO' },
  { nombre: 'Turismo', tipo: 'GASTO' },
  { nombre: 'Transporte y Movilidad', tipo: 'GASTO' },
  { nombre: 'Servicios Básicos', tipo: 'GASTO' },
  { nombre: 'Operaciones y Tecnología', tipo: 'GASTO' },
  { nombre: 'Marketing y Publicidad', tipo: 'GASTO' },
  { nombre: 'Gastos Administrativos', tipo: 'GASTO' },
  { nombre: 'Impuestos y Obligaciones SRI', tipo: 'GASTO' },
  { nombre: 'Otros Gastos', tipo: 'GASTO' },
];

async function main(): Promise<void> {
  const categorias = [...CATEGORIAS_INGRESO, ...CATEGORIAS_GASTO];

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { nombre_tipo: { nombre: categoria.nombre, tipo: categoria.tipo } },
      update: {},
      create: categoria,
    });
  }

  console.log(`Categorías sembradas correctamente: ${categorias.length}`);

  // Promueve a ADMINISTRADOR al primer usuario registrado (si existe),
  // para que exista al menos una cuenta capaz de gestionar el catálogo
  // de categorías desde /api/categorias.
  const primerUsuario = await prisma.usuario.findFirst({
    orderBy: { id: 'asc' },
  });

  if (primerUsuario && primerUsuario.rol !== 'ADMINISTRADOR') {
    await prisma.usuario.update({
      where: { id: primerUsuario.id },
      data: { rol: 'ADMINISTRADOR' },
    });
    console.log(
      `Usuario "${primerUsuario.correo}" promovido a ADMINISTRADOR.`,
    );
  }
}

main()
  .catch((error) => {
    console.error('Error al sembrar la base de datos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
