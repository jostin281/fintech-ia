import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

import type { ArchivoComprobanteSubido } from './interfaces/archivo-subido.interface';
import {
  ComprobantesRecibidosService,
  type ResumenImportacion,
} from './comprobantes-recibidos.service';
import { SriCredencialesService } from './sri-credenciales.service';

export interface ResultadoDescargaSri {
  exito: boolean;
  mensaje: string;
  resumenImportacion?: ResumenImportacion;
}

// Tiempo máximo que se deja correr el navegador headless antes de matarlo.
// El portal del SRI puede quedarse colgado; sin límite, el proceso Node
// quedaría esperando para siempre.
const TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Ejecuta, para UN usuario, el script de Playwright que entra a SRI en
 * Línea y descarga sus comprobantes recibidos, y luego importa los XML
 * resultantes reutilizando exactamente el mismo servicio que usa la
 * importación manual (mismo parseo, misma deduplicación, misma
 * categorización).
 *
 * La clave del SRI se descifra en memoria solo para este proceso hijo y no
 * se registra en ningún log: únicamente se le pasa como variable de
 * entorno al script de Python, que la usa una vez y termina.
 */
@Injectable()
export class SriDescargaRunnerService {
  private readonly logger = new Logger(SriDescargaRunnerService.name);

  constructor(
    private readonly sriCredencialesService: SriCredencialesService,
    private readonly comprobantesRecibidosService: ComprobantesRecibidosService,
    private readonly configService: ConfigService,
  ) {}

  async ejecutarParaUsuario(usuarioId: number): Promise<ResultadoDescargaSri> {
    const credencial =
      await this.sriCredencialesService.obtenerCredencialDescifrada(usuarioId);

    if (!credencial) {
      return {
        exito: false,
        mensaje: 'El usuario no tiene credenciales del SRI guardadas',
      };
    }

    const carpetaTemporal = await mkdtemp(
      join(tmpdir(), `sri-descarga-${usuarioId}-`),
    );

    try {
      const salidaScript = await this.ejecutarScriptPython(
        credencial.usuarioSri,
        credencial.claveSri,
        credencial.ciAdicionalSri,
        carpetaTemporal,
      );

      if (!salidaScript.exito) {
        await this.sriCredencialesService.registrarResultadoEjecucion(
          usuarioId,
          'ERROR',
          salidaScript.mensaje,
        );
        return { exito: false, mensaje: salidaScript.mensaje };
      }

      if (salidaScript.archivos.length === 0) {
        await this.sriCredencialesService.registrarResultadoEjecucion(
          usuarioId,
          'EXITO',
          'Sin comprobantes nuevos para descargar.',
        );
        return { exito: true, mensaje: 'Sin comprobantes nuevos para descargar.' };
      }

      const archivos = await this.leerArchivosDescargados(salidaScript.archivos);
      const resumenImportacion = await this.comprobantesRecibidosService.importar(
        usuarioId,
        archivos,
      );

      await this.sriCredencialesService.registrarResultadoEjecucion(
        usuarioId,
        'EXITO',
        resumenImportacion.mensaje,
      );

      return { exito: true, mensaje: resumenImportacion.mensaje, resumenImportacion };
    } catch (error: unknown) {
      const mensaje =
        error instanceof Error ? error.message : 'Error desconocido al descargar del SRI';
      this.logger.error(
        `Fallo la descarga automática del SRI para el usuario ${usuarioId}: ${mensaje}`,
      );
      await this.sriCredencialesService.registrarResultadoEjecucion(
        usuarioId,
        'ERROR',
        mensaje,
      );
      return { exito: false, mensaje };
    } finally {
      // Los XML ya quedaron guardados (como texto) en la base de datos vía
      // importar(); no hay razón para conservar la copia temporal en disco.
      await rm(carpetaTemporal, { recursive: true, force: true });
    }
  }

  private async leerArchivosDescargados(
    rutas: string[],
  ): Promise<ArchivoComprobanteSubido[]> {
    const archivos: ArchivoComprobanteSubido[] = [];

    for (const ruta of rutas) {
      try {
        const buffer = await readFile(ruta);
        archivos.push({
          originalname: ruta.split(/[\\/]/).pop() ?? `comprobante-${randomUUID()}.xml`,
          mimetype: 'application/xml',
          size: buffer.length,
          buffer,
        });
      } catch (error: unknown) {
        this.logger.warn(`No se pudo leer el XML descargado ${ruta}: ${String(error)}`);
      }
    }

    return archivos;
  }

  private ejecutarScriptPython(
    usuarioSri: string,
    claveSri: string,
    ciAdicionalSri: string | null,
    carpetaDestino: string,
  ): Promise<{ exito: boolean; archivos: string[]; mensaje: string }> {
    const binarioPython =
      this.configService.get<string>('SRI_PYTHON_BIN') ?? 'python3';
    const rutaScript = join(
      process.cwd(),
      'scripts',
      'sri',
      'descargar_comprobantes_sri.py',
    );

    return new Promise((resolve) => {
      const proceso = spawn(binarioPython, [rutaScript], {
        env: {
          ...process.env,
          SRI_USUARIO: usuarioSri,
          SRI_CLAVE: claveSri,
          ...(ciAdicionalSri ? { SRI_CI_ADICIONAL: ciAdicionalSri } : {}),
          SRI_DESCARGA_DESTINO: carpetaDestino,
        },
      });

      let salidaEstandar = '';
      let salidaError = '';
      let finalizado = false;

      const temporizador = setTimeout(() => {
        if (!finalizado) {
          proceso.kill('SIGKILL');
        }
      }, TIMEOUT_MS);

      proceso.stdout.on('data', (fragmento: Buffer) => {
        salidaEstandar += fragmento.toString('utf8');
      });

      proceso.stderr.on('data', (fragmento: Buffer) => {
        salidaError += fragmento.toString('utf8');
      });

      proceso.on('error', (error) => {
        finalizado = true;
        clearTimeout(temporizador);
        resolve({
          exito: false,
          archivos: [],
          mensaje: `No se pudo iniciar el proceso de Python (${binarioPython}): ${error.message}`,
        });
      });

      proceso.on('close', (codigo) => {
        finalizado = true;
        clearTimeout(temporizador);

        const resultado = this.parsearUltimaLineaJson(salidaEstandar);

        if (resultado) {
          resolve(resultado);
          return;
        }

        resolve({
          exito: false,
          archivos: [],
          mensaje:
            `El script de descarga terminó con código ${codigo} sin un resultado ` +
            `interpretable. Detalle: ${salidaError.slice(-1000) || '(sin salida de error)'}`,
        });
      });
    });
  }

  private parsearUltimaLineaJson(
    salida: string,
  ): { exito: boolean; archivos: string[]; mensaje: string } | null {
    const lineas = salida.trim().split('\n');

    for (let i = lineas.length - 1; i >= 0; i -= 1) {
      const linea = lineas[i].trim();
      if (!linea.startsWith('{')) {
        continue;
      }
      try {
        const valor: unknown = JSON.parse(linea);
        if (
          typeof valor === 'object' &&
          valor !== null &&
          'exito' in valor &&
          'archivos' in valor &&
          'mensaje' in valor
        ) {
          return valor as { exito: boolean; archivos: string[]; mensaje: string };
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}
