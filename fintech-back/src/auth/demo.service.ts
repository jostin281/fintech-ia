import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

const RONDAS_HASH = 10;

// Duración de una sesión demo. Pasado este tiempo el token deja de ser
// válido (se firma con esta misma duración) y la limpieza programada
// borra la cuenta y sus datos de ejemplo.
export const DURACION_DEMO_MINUTOS = 10;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Crea una cuenta demo desechable, la llena con datos de ejemplo y
  // devuelve un token JWT de corta duración, igual que un login normal.
  async crearSesionDemo() {
    const correoDemo = `demo-${randomUUID()}@fintech.local`;
    const contrasenaHash = await bcrypt.hash(randomUUID(), RONDAS_HASH);
    const demoExpiraEn = new Date(
      Date.now() + DURACION_DEMO_MINUTOS * 60 * 1000,
    );

    const usuario = await this.prismaService.usuario.create({
      data: {
        nombre: 'Usuario Demo',
        correo: correoDemo,
        contrasenaHash,
        rol: 'USUARIO',
        esDemo: true,
        demoExpiraEn,
      },
    });

    try {
      await this.sembrarDatosDemo(usuario.id);
    } catch (error) {
      // Si falla la siembra de datos de ejemplo la demo igual debe
      // funcionar (solo se verá vacía); nunca debe romper el login.
      this.logger.warn(
        `No se pudieron sembrar datos de ejemplo para la demo ${usuario.id}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }

    const contenidoToken = {
      sub: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      esDemo: true,
    };

    const accessToken = await this.jwtService.signAsync(contenidoToken, {
      expiresIn: `${DURACION_DEMO_MINUTOS}m`,
    });

    return {
      mensaje: 'Sesión demo iniciada',
      accessToken,
      tipoToken: 'Bearer',
      esDemo: true,
      demoExpiraEn,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        activo: true,
      },
    };
  }

  // Llena la cuenta demo con movimientos, un presupuesto y una meta de
  // ahorro de ejemplo para que la persona vea la app funcionando con
  // datos reales en vez de pantallas vacías.
  private async sembrarDatosDemo(usuarioId: number): Promise<void> {
    const [categoriasGasto, categoriasIngreso] = await Promise.all([
      this.prismaService.categoria.findMany({
        where: { tipo: 'GASTO', activa: true },
        take: 5,
        orderBy: { id: 'asc' },
      }),
      this.prismaService.categoria.findMany({
        where: { tipo: 'INGRESO', activa: true },
        take: 2,
        orderBy: { id: 'asc' },
      }),
    ]);

    const ahora = new Date();

    if (categoriasGasto.length > 0) {
      const montosGasto = [45.5, 120, 18.75, 260, 32.9];
      await this.prismaService.movimiento.createMany({
        data: categoriasGasto.map((categoria, indice) => ({
          tipo: 'GASTO' as const,
          monto: montosGasto[indice % montosGasto.length],
          descripcion: `Gasto de ejemplo en ${categoria.nombre}`,
          fecha: new Date(ahora.getFullYear(), ahora.getMonth(), 2 + indice * 4),
          usuarioId,
          categoriaId: categoria.id,
        })),
      });
    }

    if (categoriasIngreso.length > 0) {
      const montosIngreso = [1200, 350];
      await this.prismaService.movimiento.createMany({
        data: categoriasIngreso.map((categoria, indice) => ({
          tipo: 'INGRESO' as const,
          monto: montosIngreso[indice % montosIngreso.length],
          descripcion: `Ingreso de ejemplo en ${categoria.nombre}`,
          fecha: new Date(ahora.getFullYear(), ahora.getMonth(), 1 + indice * 15),
          usuarioId,
          categoriaId: categoria.id,
        })),
      });
    }

    if (categoriasGasto[0]) {
      await this.prismaService.presupuesto.create({
        data: {
          montoLimite: 300,
          mes: ahora.getMonth() + 1,
          anio: ahora.getFullYear(),
          usuarioId,
          categoriaId: categoriasGasto[0].id,
        },
      });
    }

    const fechaObjetivo = new Date(
      ahora.getFullYear(),
      ahora.getMonth() + 4,
      1,
    );

    const meta = await this.prismaService.metaAhorro.create({
      data: {
        nombre: 'Fondo de emergencia',
        montoObjetivo: 1000,
        fechaObjetivo,
        usuarioId,
      },
    });

    await this.prismaService.aporteMeta.create({
      data: {
        monto: 150,
        metaAhorroId: meta.id,
      },
    });

    // Perfil tributario + un cliente y dos productos de ejemplo, para que
    // la cuenta demo pueda crear y "emitir" una factura de una vez (ver
    // FacturasController.emitir / FacturasService.emitirSimulado: nunca
    // firma con un certificado real ni se conecta al SRI real).
    const rucDemo = `99${Math.floor(10000000 + Math.random() * 90000000)}001`;

    const perfilTributario = await this.prismaService.perfilTributario.create({
      data: {
        ruc: rucDemo,
        razonSocial: 'Negocio Demo FintechIA',
        nombreComercial: 'Demo FintechIA',
        direccionMatriz: 'Av. Demo N12-34 y Calle Ejemplo, Quito',
        tipoContribuyente: 'PERSONA_NATURAL',
        regimenTributario: 'GENERAL',
        obligadoContabilidad: false,
        ambienteSri: 'PRUEBAS',
        usuarioId,
      },
    });

    await this.prismaService.clienteFacturacion.create({
      data: {
        tipoIdentificacion: 'CEDULA',
        identificacion: '1710000001',
        razonSocial: 'Cliente de Ejemplo',
        correo: 'cliente.demo@fintech.local',
        perfilTributarioId: perfilTributario.id,
      },
    });

    await this.prismaService.productoServicioFacturacion.createMany({
      data: [
        {
          codigoPrincipal: 'DEMO001',
          descripcion: 'Servicio de consultoría (ejemplo)',
          precioUnitario: 50,
          tarifaIva: 'QUINCE',
          perfilTributarioId: perfilTributario.id,
        },
        {
          codigoPrincipal: 'DEMO002',
          descripcion: 'Licencia mensual (ejemplo)',
          precioUnitario: 25,
          tarifaIva: 'QUINCE',
          perfilTributarioId: perfilTributario.id,
        },
      ],
    });
  }
}
