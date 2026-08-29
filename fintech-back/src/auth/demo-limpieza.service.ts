import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

// Borra las cuentas demo expiradas (creadas por el botón "Usar demo")
// junto con sus datos de ejemplo. Corre cada 5 minutos; el token JWT de
// una sesión demo ya deja de servir antes (ver DemoService), así que
// esto solo limpia la base de datos, no protege nada por sí mismo.
@Injectable()
export class DemoLimpiezaService {
  private readonly logger = new Logger(DemoLimpiezaService.name);

  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async limpiarDemosExpiradas(): Promise<void> {
    const ahora = new Date();

    const demosExpiradas = await this.prismaService.usuario.findMany({
      where: { esDemo: true, demoExpiraEn: { lt: ahora } },
      select: { id: true },
    });

    if (demosExpiradas.length === 0) {
      return;
    }

    let limpiadas = 0;

    for (const { id } of demosExpiradas) {
      try {
        // Movimiento y Presupuesto usan onDelete: Restrict hacia Usuario, así
        // que hay que borrarlos primero. Como el modo demo también permite
        // crear/"emitir" facturas (ver FacturasService.emitirSimulado), una
        // cuenta demo puede tener un perfil tributario con clientes,
        // productos, facturas y secuencias — todas esas relaciones también
        // son Restrict, así que se borran en orden (hijos antes que padres)
        // antes de poder borrar el perfil tributario y, al final, el
        // usuario. El resto de las relaciones (metas, notificaciones,
        // conversaciones con el asistente, credenciales SRI, reglas
        // propias, firma electrónica) están en onDelete: Cascade y se
        // limpian solas al borrar el usuario o el perfil tributario.
        await this.prismaService.$transaction([
          this.prismaService.retencionRecibida.deleteMany({
            where: { perfilTributario: { usuarioId: id } },
          }),
          this.prismaService.facturaElectronica.deleteMany({
            where: { perfilTributario: { usuarioId: id } },
          }),
          this.prismaService.secuenciaComprobante.deleteMany({
            where: { perfilTributario: { usuarioId: id } },
          }),
          this.prismaService.clienteFacturacion.deleteMany({
            where: { perfilTributario: { usuarioId: id } },
          }),
          this.prismaService.productoServicioFacturacion.deleteMany({
            where: { perfilTributario: { usuarioId: id } },
          }),
          this.prismaService.historialFormularioRdep.deleteMany({
            where: { usuarioId: id },
          }),
          this.prismaService.formularioRdep.deleteMany({
            where: { usuarioId: id },
          }),
          this.prismaService.perfilTributario.deleteMany({
            where: { usuarioId: id },
          }),
          this.prismaService.movimiento.deleteMany({ where: { usuarioId: id } }),
          this.prismaService.presupuesto.deleteMany({ where: { usuarioId: id } }),
          this.prismaService.usuario.delete({ where: { id } }),
        ]);
        limpiadas += 1;
      } catch (error) {
        // No se detiene la limpieza del resto de cuentas demo por un
        // error en una sola (por ejemplo si llegó a tocar una función
        // bloqueada y quedó con datos que no anticipamos aquí).
        this.logger.warn(
          `No se pudo limpiar la cuenta demo ${id}: ${(error as Error)?.message ?? error}`,
        );
      }
    }

    this.logger.log(
      `Limpieza demo: ${limpiadas}/${demosExpiradas.length} cuenta(s) demo eliminadas`,
    );
  }
}
