import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../api-config';

const BASE = `${API_BASE_URL}/sri-credenciales`;

/**
 * Función OPCIONAL y apagada por defecto: guarda el usuario/clave de SRI en
 * Línea (cifrados en el backend) para que el sistema intente descargar
 * automáticamente los comprobantes recibidos. Es distinto de la
 * importación manual (comprobantes-recibidos.api.ts), que NUNCA pide
 * credenciales del SRI.
 */
export interface EstadoCredencialSriApi {
  configurado: boolean;
  usuarioSri: string | null;
  ciAdicionalSri: string | null;
  autoDescargaHabilitada: boolean;
  ultimaEjecucionEn: string | null;
  ultimoResultado: 'EXITO' | 'ERROR' | null;
  ultimoMensaje: string | null;
}

export interface ResultadoDescargaSriApi {
  exito: boolean;
  mensaje: string;
  resumenImportacion?: {
    mensaje: string;
    procesados: number;
    duplicados: number;
    noReconocidos: number;
    errores: number;
  };
}

@Injectable({ providedIn: 'root' })
export class SriCredencialesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = BASE;

  async guardar(
    usuarioSri: string,
    claveSri: string,
    ciAdicionalSri?: string,
    autoDescargaHabilitada?: boolean,
  ): Promise<EstadoCredencialSriApi> {
    const respuesta = await firstValueFrom(
      this.http.put<{ estado: EstadoCredencialSriApi }>(this.base, {
        usuarioSri,
        claveSri,
        ...(ciAdicionalSri ? { ciAdicionalSri } : {}),
        ...(autoDescargaHabilitada !== undefined ? { autoDescargaHabilitada } : {}),
      }),
    );
    return respuesta.estado;
  }

  async obtenerEstado(): Promise<EstadoCredencialSriApi> {
    return firstValueFrom(this.http.get<EstadoCredencialSriApi>(this.base));
  }

  async actualizarAutoDescarga(
    autoDescargaHabilitada: boolean,
  ): Promise<EstadoCredencialSriApi> {
    const respuesta = await firstValueFrom(
      this.http.patch<{ estado: EstadoCredencialSriApi }>(`${this.base}/auto-descarga`, {
        autoDescargaHabilitada,
      }),
    );
    return respuesta.estado;
  }

  async eliminar(): Promise<void> {
    await firstValueFrom(this.http.delete(this.base));
  }

  /** Puede tardar hasta un par de minutos: corre un navegador real por detrás. */
  async descargarAhora(): Promise<ResultadoDescargaSriApi> {
    return firstValueFrom(
      this.http.post<ResultadoDescargaSriApi>(`${this.base}/descargar-ahora`, {}),
    );
  }
}
