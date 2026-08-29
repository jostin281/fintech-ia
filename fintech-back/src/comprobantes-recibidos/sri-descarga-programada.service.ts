import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SriCredencialesService } from './sri-credenciales.service';
import { SriDescargaRunnerService } from './sri-descarga-runner.service';

/**
 * Job programado que recorre a TODOS los usuarios que activaron la
 * descarga automática de comprobantes SRI y ejecuta la descarga de cada
 * uno, uno por uno (nunca en paralelo) y con una espera aleatoria entre
 * cada usuario, para no generar un patrón de tráfico idéntico y repetido
 * contra el portal del SRI desde el mismo servidor.
 *
 * Doble interruptor de seguridad, a propósito:
 *  1) SRI_DESCARGA_AUTOMATICA_HABILITADA (variable de entorno, global):
 *     si no está en "true", este job no hace nada, sin importar cuántos
 *     usuarios hayan activado su propio interruptor.
 *  2) autoDescargaHabilitada (por usuario, en CredencialSri): cada usuario
 *     decide si quiere participar.
 *
 * Así, una persona que administra el despliegue puede apagar esta función
 * para todos de un solo lugar, incluso si algún usuario la dejó activada.
 */
@Injectable()
export class SriDescargaProgramadaService {
  private readonly logger = new Logger(SriDescargaProgramadaService.name);
  private ejecutando = false;

  constructor(
    private readonly sriCredencialesService: SriCredencialesService,
    private readonly sriDescargaRunnerService: SriDescargaRunnerService,
    private readonly configService: ConfigService,
  ) {}

  // Todos los días a las 04:10 hora de Ecuador (fuera de horario laboral,
  // para no competir con el uso normal de la app ni del portal del SRI).
  @Cron('10 4 * * *', { timeZone: 'America/Guayaquil' })
  async ejecutarDescargaProgramada(): Promise<void> {
    if (
      this.configService.get<string>('SRI_DESCARGA_AUTOMATICA_HABILITADA') !==
      'true'
    ) {
      this.logger.log(
        'Descarga automática SRI desactivada globalmente (SRI_DESCARGA_AUTOMATICA_HABILITADA != "true"); no se ejecuta nada.',
      );
      return;
    }

    if (this.ejecutando) {
      this.logger.warn(
        'La ejecución anterior de descarga automática SRI todavía no termina; se omite este ciclo.',
      );
      return;
    }

    this.ejecutando = true;

    try {
      const usuarios =
        await this.sriCredencialesService.listarUsuariosConAutoDescargaHabilitada();

      this.logger.log(
        `Descarga automática SRI: ${usuarios.length} usuario(s) con la función activada.`,
      );

      for (const usuarioId of usuarios) {
        try {
          const resultado =
            await this.sriDescargaRunnerService.ejecutarParaUsuario(usuarioId);
          this.logger.log(
            `Usuario ${usuarioId}: ${resultado.exito ? 'OK' : 'ERROR'} — ${resultado.mensaje}`,
          );
        } catch (error: unknown) {
          this.logger.error(
            `Usuario ${usuarioId}: fallo inesperado — ${String(error)}`,
          );
        }

        await this.esperarAleatorio();
      }
    } finally {
      this.ejecutando = false;
    }
  }

  // Espera entre 60 y 180 segundos, al azar, entre cada usuario.
  private esperarAleatorio(): Promise<void> {
    const milisegundos = 60_000 + Math.floor(Math.random() * 120_000);
    return new Promise((resolve) => setTimeout(resolve, milisegundos));
  }
}
